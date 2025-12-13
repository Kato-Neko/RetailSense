# AI Recommendations Setup Guide

This guide shows you how to set up **free AI-powered recommendations** for your heatmap analysis.

## 🎯 Recommended: Google Gemini Pro (Free for University Students!)

**Why Gemini Pro?**
- ✅ **FREE Gemini Pro** for university students (includes full API access!)
- ✅ **Premium model** (Gemini 1.5 Pro) - smarter and more capable than free tier
- ✅ **Higher quality** recommendations with better context understanding
- ✅ **Student benefits**: Better rate limits than free tier
- ✅ **No credit card required** for student subscriptions

### Setup Steps:

1. **Get Gemini Pro (Student Subscription):**
   - Go to https://one.google.com/ai-student (or check your Google One student benefits)
   - Sign up for Gemini AI Pro as a university student
   - Verify your student status if needed

2. **Get API Key:**
   - Go to https://aistudio.google.com/apikey
   - Sign in with your Google account (the one with student subscription)
   - Create an API key (works with your Pro subscription!)

3. **Install package:**
   ```bash
   pip install google-generativeai
   ```
   (Already included in `requirements.txt`)

4. **Add to Railway/env variables:**
   ```
   USE_AI_RECOMMENDATIONS=true
   GEMINI_API_KEY=your_gemini_api_key_here
   GEMINI_MODEL=gemini-1.5-pro  # Pro model - best quality (free for students!)
   ```

**Perfect for students!** You get the premium Gemini Pro model for free, which generates much better, more nuanced recommendations than the standard free tier.

## 🚀 Alternative: Groq (Also Free)

**Why Groq?**
- ✅ **Completely FREE** with high limits
- ✅ **Very fast** inference (often < 1 second)
- ✅ **High quality** models (Llama 3.1 70B, Mixtral, etc.)
- ✅ **Generous limits**: 30 requests/minute, 14,400 requests/day
- ✅ **No credit card required**

### Setup Steps:

1. **Get API Key:**
   - Go to https://console.groq.com/
   - Sign up for free (no credit card needed)
   - Create an API key

2. **Install package:**
   ```bash
   pip install groq
   ```
   (Uncomment in `requirements.txt` if using)

3. **Add to Railway/env variables:**
   ```
   USE_AI_RECOMMENDATIONS=true
   GROQ_API_KEY=your_groq_api_key_here
   GROQ_MODEL=llama-3.1-70b-versatile  # Optional, this is the default
   ```

## 💰 Paid Option: OpenAI (Very Cheap)

If you want to use OpenAI instead (not free but very affordable):

1. **Get API Key:**
   - Go to https://platform.openai.com/api-keys
   - Add payment method (min $5)
   - Create API key

2. **Install package:**
   ```bash
   pip install openai
   ```
   (Uncomment in `requirements.txt` if using)

3. **Add to Railway/env variables:**
   ```
   USE_AI_RECOMMENDATIONS=true
   OPENAI_API_KEY=your_openai_api_key_here
   OPENAI_MODEL=gpt-4o-mini  # Optional, cheap model (~$0.15/1M tokens)
   ```

## 🚀 How It Works

Once configured, the system will:
1. Automatically detect which API key you have
2. Use that provider for generating recommendations
3. Generate smart, contextual recommendations based on:
   - Traffic distribution percentages
   - Total visitor count
   - Peak hour patterns
   - Region density data

4. **Fallback**: If AI fails or is disabled, it uses rule-based recommendations

## 📝 Requirements

The `google-generativeai` package is already included in `requirements.txt` (recommended for students).

For other providers, uncomment the relevant line in `requirements.txt`:
- Groq: `groq>=0.4.0`
- OpenAI: `openai>=1.0.0`

## 🎨 Result

Instead of generic recommendations like:
- "Implement strategies to increase traffic in low-density areas"

You'll get smart, contextual ones like:
- "With 23 visitors and 44.4% low-density areas, consider relocating promotional displays from checkout to aisle 3-5 to redistribute foot traffic"
- "Peak traffic at 5:38 AM suggests early morning customers cluster near entrance - expand product visibility in back aisles during this time"

---

**Recommendation: Start with Gemini Pro if you're a university student** - it's completely free and gives you the premium model with best quality recommendations! 🎓✨

If you're not a student, **Groq is the best free alternative** - fast, free, and has excellent limits! 🚀
