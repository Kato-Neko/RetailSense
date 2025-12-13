"""
AI-powered analysis for heatmap recommendations.
Supports multiple free AI providers: Groq (recommended) and Google Gemini.
"""

import os
import json
import logging
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

def _get_ai_provider(provider: Optional[str] = None) -> Optional[str]:
    """
    Determines the AI provider to use based on the provided argument and available API keys.
    """
    if provider:
        return provider
    
    # Auto-detect provider if not specified, with a preferred order
    if os.getenv('GROQ_API_KEY'):
        return 'groq'
    if os.getenv('GEMINI_API_KEY'):
        return 'gemini'
    if os.getenv('OPENAI_API_KEY'):
        return 'openai'
    
    return None


# --- Non-Streaming Functions ---

_PROVIDER_FUNCTIONS = {
    'groq': lambda p, c: _call_groq(p, c),
    'gemini': lambda p, c: _call_gemini_with_fallback(p, c),
    'openai': lambda p, c: _call_openai(p, c),
}

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
    selected_provider = _get_ai_provider(provider)
    if not selected_provider:
        logger.info("No AI provider specified or API keys found, using rule-based recommendations")
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
    provider_func = _PROVIDER_FUNCTIONS.get(selected_provider)
    if provider_func:
        try:
            return provider_func(prompt, context), True
        except Exception as e:
            logger.error(f"AI provider '{selected_provider}' failed: {e}")

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
    # Preferred model from env; fallbacks based on your list_models() output
    preferred = os.getenv('GEMINI_MODEL')
    fallback_order = [
        # prefer env override first
        preferred,
        # 2.x and 1.x families that are widely available
        'gemini-pro-latest',
        'gemini-flash-latest',
        # fully-qualified names for some accounts
        'models/gemini-pro-latest',
        'models/gemini-flash-latest',
    ]
    # Remove Nones and keep order
    candidates = [m for m in fallback_order if m]

    last_err = None
    quota_exceeded = False
    for model_id in candidates:
        try:
            model = genai.GenerativeModel(model_id)
            full_prompt = (
                f"{prompt}\n\n"
                "Return your response as a JSON array only, with no narration."
            )
            resp = model.generate_content(
                full_prompt,
                generation_config={
                    'temperature': 0.7,
                    'max_output_tokens': 200,
                }
            )
            # Robust parsing: avoid resp.text; use candidates/parts
            if not getattr(resp, 'candidates', None):
                raise RuntimeError('No candidates returned')
            for cand in resp.candidates:
                # finish_reason 2 means blocked; skip
                if getattr(cand, 'finish_reason', None) == 2:
                    continue
                content = getattr(cand, 'content', None)
                if not content or not getattr(content, 'parts', None):
                    continue
                texts: List[str] = []
                for p in content.parts:
                    t = getattr(p, 'text', None)
                    if t:
                        texts.append(t)
                if texts:
                    return _parse_ai_response("\n".join(texts), context)
            # If we fell through, try next model
            raise RuntimeError('No valid text parts in candidates')
        except Exception as e:
            last_err = e
            err_str = str(e).lower()
            # Check for quota/rate limit errors - stop trying other models
            if '429' in str(e) or 'quota' in err_str or 'rate limit' in err_str:
                quota_exceeded = True
                logger.warning(f"Gemini quota exceeded on {model_id}. Stopping fallback attempts.")
                break
            logger.error(f"Gemini call failed for {model_id}: {e}")
            continue
    
    if quota_exceeded:
        raise RuntimeError("Gemini API quota exceeded - please check your plan and billing details")
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

# --- Streaming Functions ---

def generate_ai_recommendations_stream(
    areas: Dict,
    total_visitors: int,
    peak_hours: List[Dict],
    provider: Optional[str] = None
):
    """
    Generate and stream AI-powered recommendations.
    Yields recommendations as they are generated.
    """
    # This was moved here from above to be after the function definitions
    _STREAM_PROVIDER_FUNCTIONS = {
        'groq': _call_groq_stream,
        'gemini': _call_gemini_stream,
        'openai': _call_openai_stream,
    }

    selected_provider = _get_ai_provider(provider)
    if not selected_provider:
        for rec in _generate_rule_based_recommendations(areas, total_visitors):
            yield rec
        return

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
    prompt = _build_prompt(context, total_visitors, peak_hours)

    stream_func = _STREAM_PROVIDER_FUNCTIONS.get(selected_provider)
    if stream_func:
        try:
            yield from stream_func(prompt)
        except Exception as e:
            logger.error(f"AI provider '{selected_provider}' streaming failed: {e}")
            yield "Error generating AI recommendations."
    else:
        # Fallback for safety, though _get_ai_provider should prevent this
        for rec in _generate_rule_based_recommendations(areas, total_visitors):
            for rec in _generate_rule_based_recommendations(areas, total_visitors):
                yield rec

def _call_groq_stream(prompt: str):
    """Call Groq API with streaming."""
    try:
        from groq import Groq
        client = Groq(api_key=os.getenv('GROQ_API_KEY'))
        model = os.getenv('GROQ_MODEL', 'llama-3.1-70b-versatile')
        response_stream = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "You are a retail analytics expert. Always return valid JSON arrays."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=200,
            stream=True
        )
        yield from _parse_ai_stream(response_stream)
    except ImportError:
        raise RuntimeError("groq not installed")

def _call_gemini_stream(prompt: str):
    """Call Gemini API with streaming."""
    try:
        import google.generativeai as genai
        genai.configure(api_key=os.getenv('GEMINI_API_KEY'))
        model = genai.GenerativeModel(os.getenv('GEMINI_MODEL', 'gemini-pro-latest'))
        response_stream = model.generate_content(prompt, stream=True)
        yield from _parse_ai_stream(response_stream)
    except ImportError:
        raise RuntimeError("google-generativeai not installed")

def _call_openai_stream(prompt: str):
    """Call OpenAI API with streaming."""
    try:
        import openai
        client = openai.OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
        model = os.getenv('OPENAI_MODEL', 'gpt-4o-mini')
        response_stream = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "You are a retail analytics expert. Always return valid JSON arrays."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=200,
            stream=True
        )
        yield from _parse_ai_stream(response_stream)
    except ImportError:
        raise RuntimeError("openai not installed")

def _parse_ai_stream(response_stream):
    """Parse streaming JSON response from AI provider."""
    buffer = ""
    for chunk in response_stream:
        # The actual way to get the content from the chunk depends on the provider
        delta_content = None
        if hasattr(chunk, 'choices') and chunk.choices:
            delta = chunk.choices[0].delta
            if delta:
                delta_content = delta.content
        elif hasattr(chunk, 'text'):
            delta_content = chunk.text

        if delta_content:
            buffer += delta_content
            
            # Try to parse recommendations from buffer
            # This is a simplified parser, assuming recommendations are separated by newlines
            while '\n' in buffer:
                line, buffer = buffer.split('\n', 1)
                line = line.strip()
                if line.startswith('"') and line.endswith('"'):
                    yield line[1:-1]
                elif line.startswith('- '):
                    yield line[2:]
                elif line:
                    yield line
