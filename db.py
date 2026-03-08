"""
db.py - MongoDB connection module for SkillForge backend.
"""

import os
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")

client = MongoClient(MONGODB_URI)
db = client["skillforge"]

# Collections
past_learning_col = db["past_learning"]
videos_col = db["videos"]
