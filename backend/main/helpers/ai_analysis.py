"""
AI-powered analysis for heatmap recommendations.
Supports multiple free AI providers: Groq (recommended) and Google Gemini.
"""

import os
import json
import logging
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

def generate_ai_recommendations(
    areas: Dict,
    total_visitors: int,
    peak_hours: List[Dict],
    provider: Optional[str] = None
) -> Tuple[List[str], bool]:
    """
    Generate AI-powered recommendations based on heatmap analysis.

    Returns (recommendations, used_ai)
    """
    # Auto-detect provider if not specified
    if provider is None:
        if os.getenv('GROQ_API_KEY'):
            provider = 'groq'
        elif os.getenv('GEMINI_API_KEY'):
            provider = 'gemini'
        elif os.getenv('OPENAI_API_KEY'):
            provider = 'openai'
        else:
            logger.info("No AI API keys found, using rule-based recommendations")
            return _generate_rule_based_recommendations(areas, total_visitors), False

    # Prepare context
    context = {
        "traffic_distribution": {
            "high_density_percentage": areas.get('high', {}).get('percentage', 0),
            "medium_density_percentage": areas.get('medium', {}).get('percentage', 0),
            "low_density_percentage": areas.get('low', {}).get('percentage', 0),
        },
        "total_visitors": total_visitors,
        "peak_periods": peak_hours,
        "high_density_regions_count": len(areas.get('high', {}).get('regions', [])),
        "low_density_regions_count": len(areas.get('low', {}).get('regions', []))
    }

    # Create prompt
    prompt = _build_prompt(context, total_visitors, peak_hours)

    # Try different providers
    try:
        if provider == 'groq':
            recs = _call_groq(prompt, context)
            return recs, True
        if provider == 'gemini':
            recs = _call_gemini_with_fallback(prompt, context)
            return recs, True
        if provider == 'openai':
            recs = _call_openai(prompt, context)
            return recs, True
    except Exception as e:
        logger.error(f"AI provider '{provider}' failed: {e}")

    # Fallback
    return _generate_rule_based_recommendations(areas, total_visitors), False


def _build_prompt(context: Dict, total_visitors: int, peak_hours: List[Dict]) -> str:
    return (
        f"You are a retail analytics expert analyzing foot traffic heatmap data.\n\n"
        f"Traffic Distribution:\n"
        f"- High density areas: {context['traffic_distribution']['high_density_percentage']}%\n"
        f"- Medium density areas: {context['traffic_distribution']['medium_density_percentage']}%\n"
        f"- Low density areas: {context['traffic_distribution']['low_density_percentage']}%\n\n"
        f"Additional Metrics:\n"
        f"- Total unique visitors: {total_visitors}\n"
        f"- Number of high-density regions: {context['high_density_regions_count']}\n"
        f"- Number of low-density regions: {context['low_density_regions_count']}\n"
        f"- Peak traffic periods: {len(peak_hours)} periods identified\n\n"
        f"Generate 2-3 actionable, specific recommendations for optimizing store layout and customer flow.\n"
        f"Be concise (one sentence each).\n\n"
        f"Return ONLY a JSON array of recommendation strings, no other text."
    )


def _call_gemini_with_fallback(prompt: str, context: Dict) -> List[str]:
    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY not set")
    try:
        import google.generativeai as genai
    except ImportError:
        raise RuntimeError("google-generativeai not installed")

    genai.configure(api_key=api_key)
    # Preferred Pro model; fallback to Flash
    preferred = os.getenv('GEMINI_MODEL', 'gemini-1.5-pro-latest')
    fallbacks = [preferred, 'gemini-1.5-flash-latest'] if preferred != 'gemini-1.5-flash-latest' else [preferred]

    last_err = None
    for model_id in fallbacks:
        try:
            model = genai.GenerativeModel(model_id)
            full_prompt = f"{prompt}\n\nReturn your response as a JSON array only."
            resp = model.generate_content(full_prompt, generation_config={'temperature': 0.7, 'max_output_tokens': 200})
            return _parse_ai_response(resp.text, context)
        except Exception as e:
            last_err = e
            logger.error(f"Gemini call failed for {model_id}: {e}")
            continue
    raise RuntimeError(str(last_err) or "Gemini call failed")


def _call_groq(prompt: str, context: Dict) -> List[str]:
    api_key = os.getenv('GROQ_API_KEY')
    if not api_key:
        raise RuntimeError("GROQ_API_KEY not set")
    try:
        from groq import Groq
    except ImportError:
        raise RuntimeError("groq not installed")
    client = Groq(api_key=api_key)
    model = os.getenv('GROQ_MODEL', 'llama-3.1-70b-versatile')
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": "You are a retail analytics expert. Always return valid JSON arrays."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.7,
        max_tokens=200,
        response_format={"type": "json_object"}
    )
    return _parse_ai_response(response.choices[0].message.content, context)


def _call_openai(prompt: str, context: Dict) -> List[str]:
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY not set")
    try:
        import openai
    except ImportError:
        raise RuntimeError("openai not installed")
    client = openai.OpenAI(api_key=api_key)
    response = client.chat.completions.create(
        model=os.getenv('OPENAI_MODEL', 'gpt-4o-mini'),
        messages=[
            {"role": "system", "content": "You are a retail analytics expert. Always return valid JSON arrays."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.7,
        max_tokens=200,
        response_format={"type": "json_object"}
    )
    return _parse_ai_response(response.choices[0].message.content, context)


def _parse_ai_response(content: str, context: Dict) -> List[str]:
    try:
        content = content.strip()
        if content.startswith('```'):
            lines = content.split('\n')
            content = '\n'.join(lines[1:-1]) if len(lines) > 2 else content
        result = json.loads(content)
        if isinstance(result, dict):
            # Accept {'recommendations': [...]} or {'items': [...]} etc.
            for v in result.values():
                if isinstance(v, list):
                    if all(isinstance(x, str) for x in v):
                        return v[:3]
            raise ValueError("JSON object did not contain string array")
        if isinstance(result, list) and all(isinstance(r, str) for r in result):
            return result[:3]
        raise ValueError("Unexpected response format")
    except Exception as e:
        raise RuntimeError(f"Failed to parse AI response: {e}")


def _generate_rule_based_recommendations(areas: Dict, total_visitors: int) -> List[str]:
    recommendations = []
    high_pct = areas.get('high', {}).get('percentage', 0)
    low_pct = areas.get('low', {}).get('percentage', 0)
    medium_pct = areas.get('medium', {}).get('percentage', 0)
    if high_pct > 30:
        recommendations.append("Consider redistributing traffic from high-density areas to improve customer flow")
    if low_pct > 40:
        recommendations.append("Implement strategies to increase traffic in low-density areas")
    if medium_pct < 30:
        recommendations.append("Optimize store layout to create more balanced traffic distribution")
    if total_visitors > 50 and high_pct > 25:
        recommendations.append("High visitor volume detected in concentrated areas - consider expanding popular product displays")
    elif total_visitors < 10 and low_pct > 50:
        recommendations.append("Low overall traffic detected - review store hours or marketing strategies")
    return recommendations if recommendations else ["Monitor traffic patterns over time to identify optimization opportunities"]
