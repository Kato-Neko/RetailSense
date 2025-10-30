"""
AI-powered analysis for heatmap recommendations.
Supports multiple free AI providers: Groq (recommended) and Google Gemini.
"""

import os
import json
import logging
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

def generate_ai_recommendations(
    areas: Dict,
    total_visitors: int,
    peak_hours: List[Dict],
    provider: Optional[str] = None
) -> List[str]:
    """
    Generate AI-powered recommendations based on heatmap analysis.
    
    Supported providers:
    - 'groq' (recommended): Free, fast, high limits (30 req/min, 14,400/day)
    - 'gemini': Google's free tier (15 req/min, 1,500/day)
    - 'openai': Paid but cheap (gpt-4o-mini)
    
    Args:
        areas: Dict with 'high', 'medium', 'low' percentages and regions
        total_visitors: Total number of unique visitors detected
        peak_hours: List of peak hour periods with counts
        provider: AI provider to use ('groq', 'gemini', 'openai', or None for auto)
    
    Returns:
        List of recommendation strings
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
            return _generate_rule_based_recommendations(areas, total_visitors)
    
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
    prompt = f"""You are a retail analytics expert analyzing foot traffic heatmap data.

Traffic Distribution:
- High density areas: {context['traffic_distribution']['high_density_percentage']}%
- Medium density areas: {context['traffic_distribution']['medium_density_percentage']}%
- Low density areas: {context['traffic_distribution']['low_density_percentage']}%

Additional Metrics:
- Total unique visitors: {total_visitors}
- Number of high-density regions: {context['high_density_regions_count']}
- Number of low-density regions: {context['low_density_regions_count']}
- Peak traffic periods: {len(peak_hours)} periods identified

Generate 2-3 actionable, specific recommendations for optimizing store layout and customer flow. 
Be concise (one sentence each), focus on practical retail improvements, and consider:
1. How to redirect traffic from overcrowded areas
2. How to improve visibility/accessibility of underutilized areas  
3. Store layout optimization strategies

Return ONLY a JSON array of recommendation strings, no other text.
Example: ["Recommendation 1", "Recommendation 2", "Recommendation 3"]
"""
    
    # Try different providers
    if provider == 'groq':
        return _call_groq(prompt, context)
    elif provider == 'gemini':
        return _call_gemini(prompt, context)
    elif provider == 'openai':
        return _call_openai(prompt, context)
    else:
        logger.warning(f"Unknown provider: {provider}, using rule-based")
        return _generate_rule_based_recommendations(areas, total_visitors)


def _call_groq(prompt: str, context: Dict) -> List[str]:
    """Call Groq API (free, fast, high limits)."""
    api_key = os.getenv('GROQ_API_KEY')
    if not api_key:
        logger.warning("GROQ_API_KEY not set")
        return _generate_rule_based_recommendations(
            {'high': {'percentage': context['traffic_distribution']['high_density_percentage']},
             'medium': {'percentage': context['traffic_distribution']['medium_density_percentage']},
             'low': {'percentage': context['traffic_distribution']['low_density_percentage']}},
            context['total_visitors']
        )
    
    try:
        try:
            from groq import Groq
        except ImportError:
            logger.warning("Groq package not installed. Install with: pip install groq")
            return _generate_rule_based_recommendations(
                {'high': {'percentage': context['traffic_distribution']['high_density_percentage']},
                 'medium': {'percentage': context['traffic_distribution']['medium_density_percentage']},
                 'low': {'percentage': context['traffic_distribution']['low_density_percentage']}},
                context['total_visitors']
            )
        
        client = Groq(api_key=api_key)
        model = os.getenv('GROQ_MODEL', 'llama-3.1-70b-versatile')  # Fast and smart
        
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
        
    except Exception as e:
        logger.error(f"Error calling Groq API: {e}")
        return _generate_rule_based_recommendations(
            {'high': {'percentage': context['traffic_distribution']['high_density_percentage']},
             'medium': {'percentage': context['traffic_distribution']['medium_density_percentage']},
             'low': {'percentage': context['traffic_distribution']['low_density_percentage']}},
            context['total_visitors']
        )


def _call_gemini(prompt: str, context: Dict) -> List[str]:
    """Call Google Gemini API (free tier with good limits)."""
    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key:
        logger.warning("GEMINI_API_KEY not set")
        return _generate_rule_based_recommendations(
            {'high': {'percentage': context['traffic_distribution']['high_density_percentage']},
             'medium': {'percentage': context['traffic_distribution']['medium_density_percentage']},
             'low': {'percentage': context['traffic_distribution']['low_density_percentage']}},
            context['total_visitors']
        )
    
    try:
        try:
            import google.generativeai as genai
        except ImportError:
            logger.warning("Google Generative AI package not installed. Install with: pip install google-generativeai")
            return _generate_rule_based_recommendations(
                {'high': {'percentage': context['traffic_distribution']['high_density_percentage']},
                 'medium': {'percentage': context['traffic_distribution']['medium_density_percentage']},
                 'low': {'percentage': context['traffic_distribution']['low_density_percentage']}},
                context['total_visitors']
            )
        
        genai.configure(api_key=api_key)
        # Use Pro model if available (student subscription), otherwise Flash
        model = genai.GenerativeModel(os.getenv('GEMINI_MODEL', 'gemini-1.5-pro'))  # Pro for better quality
        
        # Gemini uses a different format
        full_prompt = f"{prompt}\n\nReturn your response as a JSON object with a 'recommendations' key containing an array of strings."
        
        response = model.generate_content(
            full_prompt,
            generation_config={
                'temperature': 0.7,
                'max_output_tokens': 200,
            }
        )
        
        return _parse_ai_response(response.text, context)
        
    except Exception as e:
        logger.error(f"Error calling Gemini API: {e}")
        return _generate_rule_based_recommendations(
            {'high': {'percentage': context['traffic_distribution']['high_density_percentage']},
             'medium': {'percentage': context['traffic_distribution']['medium_density_percentage']},
             'low': {'percentage': context['traffic_distribution']['low_density_percentage']}},
            context['total_visitors']
        )


def _call_openai(prompt: str, context: Dict) -> List[str]:
    """Call OpenAI API (paid but cheap)."""
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        logger.warning("OPENAI_API_KEY not set")
        return _generate_rule_based_recommendations(
            {'high': {'percentage': context['traffic_distribution']['high_density_percentage']},
             'medium': {'percentage': context['traffic_distribution']['medium_density_percentage']},
             'low': {'percentage': context['traffic_distribution']['low_density_percentage']}},
            context['total_visitors']
        )
    
    try:
        try:
            import openai
        except ImportError:
            logger.warning("OpenAI package not installed. Install with: pip install openai")
            return _generate_rule_based_recommendations(
                {'high': {'percentage': context['traffic_distribution']['high_density_percentage']},
                 'medium': {'percentage': context['traffic_distribution']['medium_density_percentage']},
                 'low': {'percentage': context['traffic_distribution']['low_density_percentage']}},
                context['total_visitors']
            )
        
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
        
    except Exception as e:
        logger.error(f"Error calling OpenAI API: {e}")
        return _generate_rule_based_recommendations(
            {'high': {'percentage': context['traffic_distribution']['high_density_percentage']},
             'medium': {'percentage': context['traffic_distribution']['medium_density_percentage']},
             'low': {'percentage': context['traffic_distribution']['low_density_percentage']}},
            context['total_visitors']
        )


def _parse_ai_response(content: str, context: Dict) -> List[str]:
    """Parse AI response and extract recommendations."""
    try:
        # Try to extract JSON from response (handle markdown code blocks)
        content = content.strip()
        if content.startswith('```'):
            # Extract JSON from code block
            lines = content.split('\n')
            content = '\n'.join(lines[1:-1]) if len(lines) > 2 else content
        
        result = json.loads(content)
        
        # Handle different response formats
        if isinstance(result, dict):
            recommendations = result.get('recommendations', list(result.values())[0] if result else [])
        elif isinstance(result, list):
            recommendations = result
        else:
            raise ValueError("Unexpected response format")
        
        if isinstance(recommendations, list) and all(isinstance(r, str) for r in recommendations):
            logger.info(f"Generated {len(recommendations)} AI recommendations")
            return recommendations[:3]  # Limit to 3 recommendations
        
    except (json.JSONDecodeError, KeyError, AttributeError, ValueError) as e:
        logger.error(f"Failed to parse AI response: {e}. Content: {content}")
    
    return _generate_rule_based_recommendations(
        {'high': {'percentage': context['traffic_distribution']['high_density_percentage']},
         'medium': {'percentage': context['traffic_distribution']['medium_density_percentage']},
         'low': {'percentage': context['traffic_distribution']['low_density_percentage']}},
        context['total_visitors']
    )


def _generate_rule_based_recommendations(areas: Dict, total_visitors: int) -> List[str]:
    """Fallback rule-based recommendation generator."""
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
    
    # Add visitor-based insights
    if total_visitors > 50 and high_pct > 25:
        recommendations.append("High visitor volume detected in concentrated areas - consider expanding popular product displays")
    elif total_visitors < 10 and low_pct > 50:
        recommendations.append("Low overall traffic detected - review store hours or marketing strategies")
    
    return recommendations if recommendations else ["Monitor traffic patterns over time to identify optimization opportunities"]
