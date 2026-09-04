#!/usr/bin/env python3
import sys
import json
try:
    from youtube_transcript_api import YouTubeTranscriptApi
except ImportError:
    print(json.dumps({"error": "youtube_transcript_api not installed"}))
    sys.exit(1)

def fetch(video_id):
    try:
        ytt = YouTubeTranscriptApi()
        # try fetch directly
        try:
            transcript = ytt.fetch(video_id, languages=['id','en','en-US'])
            # transcript is FetchedTranscript iterable
            result = []
            for entry in transcript:
                # entry may be dict-like or object
                if isinstance(entry, dict):
                    result.append({"start": entry.get("start",0), "duration": entry.get("duration",0), "text": entry.get("text","")})
                else:
                    # FetchedTranscriptSnippet
                    result.append({"start": getattr(entry, 'start', 0), "duration": getattr(entry, 'duration', 0), "text": getattr(entry, 'text', str(entry))})
            print(json.dumps({"transcript": result}))
            return
        except Exception as e1:
            # fallback list
            listing = ytt.list(video_id)
            for tr in listing:
                try:
                    data = tr.fetch()
                    result = []
                    for entry in data:
                        if isinstance(entry, dict):
                            result.append({"start": entry.get("start",0), "duration": entry.get("duration",0), "text": entry.get("text","")})
                        else:
                            result.append({"start": getattr(entry,'start',0), "duration": getattr(entry,'duration',0), "text": getattr(entry,'text', str(entry))})
                    print(json.dumps({"transcript": result}))
                    return
                except:
                    continue
            raise e1
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "missing video_id"}))
        sys.exit(1)
    vid = sys.argv[1]
    if "v=" in vid:
        import urllib.parse as up
        parsed = up.urlparse(vid)
        qs = up.parse_qs(parsed.query)
        if "v" in qs:
            vid = qs["v"][0]
        else:
            vid = vid.split("v=")[-1].split("&")[0]
    if "youtu.be/" in vid:
        vid = vid.split("youtu.be/")[-1].split("?")[0].split("&")[0]
    fetch(vid)
