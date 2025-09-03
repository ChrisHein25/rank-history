import requests

BASE_URL = "https://sports.core.api.espn.com/v2/sports/football/leagues/college-football"
YEAR = 2024
POLL_IDS = range(100)  # expand as needed

def fetch_json(url):
    resp = requests.get(url)
    resp.raise_for_status()
    return resp.json()

for poll_id in POLL_IDS:
    try:
        # Get listing for this poll
        listing_url = f"{BASE_URL}/seasons/{YEAR}/rankings/{poll_id}?lang=en&region=us"
        listing = fetch_json(listing_url)

        rankings = listing.get("rankings", [])
        if not rankings:
            print(f"poll_id {poll_id}: no rankings found")
            continue

        # Grab the first week reference
        week_ref = rankings[0].get("$ref")
        week_data = fetch_json(week_ref)

        print(f"poll_id {poll_id} → {week_data['name']}")
        # # Extract poll metadata
        # poll_meta = week_data.get("poll", {})
        # poll_name = poll_meta.get("name", "<unknown>")
        # print(f"poll_id {poll_id} → {poll_name}")
    except Exception as e:
        print(f"poll_id {poll_id} failed: {e}")
