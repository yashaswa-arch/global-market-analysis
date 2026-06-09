import logging
from collections import Counter
from fastapi import APIRouter, HTTPException
from app.database.supabase_client import get_supabase

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/analytics", tags=["analytics"])

@router.get("/sources")
def get_source_analytics():
    db = get_supabase()
    
    try:
        # Fetch events to compute clusters and confidence
        events_res = db.table("events").select("id, source_count, analysis(confidence_score)").execute()
        events = events_res.data or []
        
        # Fetch event sources to compute total articles and source distribution
        sources_res = db.table("event_sources").select("event_id, source").execute()
        event_sources = sources_res.data or []
        
        # Total Clusters and Articles
        total_clusters = len(events)
        total_articles = len(event_sources)
        avg_sources_per_cluster = total_articles / total_clusters if total_clusters > 0 else 0
        
        # Source Distribution
        source_counts = Counter()
        for es in event_sources:
            source_name = es.get("source") or "Unknown"
            source_counts[source_name] += 1
            
        # Group event_sources by event_id for source diversity
        event_sources_map = {}
        for es in event_sources:
            eid = str(es.get("event_id"))
            if eid not in event_sources_map:
                event_sources_map[eid] = set()
            event_sources_map[eid].add(es.get("source"))
            
        # Confidence Distribution
        conf_dist = {
            "0-20": 0,
            "20-40": 0,
            "40-60": 0,
            "60-80": 0,
            "80-100": 0
        }
        
        # Cluster Quality Distribution
        quality_dist = {
            "Poor": 0,
            "Moderate": 0,
            "Strong": 0,
            "High Confidence": 0
        }
        
        high_confidence_clusters = 0
        
        for e in events:
            # Source Count
            sc = e.get("source_count") or 1
            
            # Source Diversity
            eid = str(e.get("id"))
            diversity = len(event_sources_map.get(eid, set(["Unknown"])))
            
            # Confidence Score
            analysis_data = e.get("analysis")
            # Supabase Python might return analysis as a dict (if one-to-one) or list (if one-to-many)
            if isinstance(analysis_data, list) and len(analysis_data) > 0:
                conf = analysis_data[0].get("confidence_score") or 0.0
            elif isinstance(analysis_data, dict):
                conf = analysis_data.get("confidence_score") or 0.0
            else:
                conf = 0.0
                
            # Bin confidence
            if conf <= 20: conf_dist["0-20"] += 1
            elif conf <= 40: conf_dist["20-40"] += 1
            elif conf <= 60: conf_dist["40-60"] += 1
            elif conf <= 80: conf_dist["60-80"] += 1
            else: conf_dist["80-100"] += 1
            
            # Calculate Cluster Quality
            # Using: source_count, source_diversity, confidence
            if sc >= 3 and diversity >= 2 and conf >= 80:
                quality_dist["High Confidence"] += 1
                high_confidence_clusters += 1
            elif sc >= 2 and diversity >= 2 and conf >= 60:
                quality_dist["Strong"] += 1
            elif conf >= 40:
                quality_dist["Moderate"] += 1
            else:
                quality_dist["Poor"] += 1
                
        return {
            "total_articles": total_articles,
            "total_clusters": total_clusters,
            "avg_sources_per_cluster": round(avg_sources_per_cluster, 2),
            "high_confidence_clusters": high_confidence_clusters,
            "source_distribution": dict(source_counts),
            "confidence_distribution": conf_dist,
            "cluster_quality_distribution": quality_dist
        }
        
    except Exception as exc:
        error_msg = str(exc)
        if "PGRST205" in error_msg and "event_sources" in error_msg:
            logger.exception("Database schema error in analytics/sources")
            raise HTTPException(
                status_code=500, 
                detail="Database schema incomplete: Missing 'event_sources' table. Please execute '001_deep_analysis_schema.sql' in your Supabase SQL Editor."
            )
        logger.exception("Failed to fetch analytics sources")
        raise HTTPException(status_code=500, detail=f"Database query failed: {error_msg}")
