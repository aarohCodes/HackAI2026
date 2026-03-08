"""
db.py — Sync pymongo connection for aaroh's backend modules.
Provides the same collection handles that flowchart.py, summary.py, quiz.py, video.py expect.
"""

import os
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

MONGODB_URI = os.getenv("MONGO_DB_URI") or os.getenv("MONGODB_URI", "mongodb://localhost:27017")
MONGODB_DB = os.getenv("MONGO_DB_NAME") or os.getenv("MONGODB_DB", "cortex")

client = MongoClient(MONGODB_URI)
db = client[MONGODB_DB]

# Collections used by aaroh's modules
past_learning_col = db["past_learning"]
videos_col = db["videos"]
