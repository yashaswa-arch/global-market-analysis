from app.config.settings import get_settings
settings = get_settings()
print("GROQ_API_KEY:", settings.groq_api_key)
