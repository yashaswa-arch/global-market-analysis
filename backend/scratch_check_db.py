import os
from supabase import create_client, Client

url = "https://wzowzacuberjfojhmimo.supabase.co"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6b3d6YWN1YmVyamZvamhtaW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDgxNDI1NiwiZXhwIjoyMDk2MzkwMjU2fQ.sBSHxq7dDQA9YmL3zuSwHD03220Tw4d-Q8hBPxWuuNQ"

supabase: Client = create_client(url, key)

try:
    res = supabase.table("event_sources").select("*").limit(1).execute()
    print("event_sources:", res)
except Exception as e:
    print("Error querying event_sources:", e)

try:
    res = supabase.rpc("search_events_deep", {"query_text": "test"}).execute()
    print("search_events_deep:", res)
except Exception as e:
    print("Error querying search_events_deep:", e)

