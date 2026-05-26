IMAGE_ANALYSIS_PROMPT = """Analyze the product image to help generate Korean marketing copy.
Extract only structured features visible in the image.
Do not guess invisible performance, materials, specifications, brand claims, or usage results.
Put uncertain or unverifiable information in uncertainties.
Return JSON only, with this exact shape:
{
  "features": {
    "category": "",
    "colors": [],
    "materials": [],
    "style_keywords": [],
    "use_cases": [],
    "target_audience": [],
    "selling_points": [],
    "detected_text": [],
    "uncertainties": []
  },
  "recommendedKeywords": [],
  "recommendedSummary": ""
}"""

