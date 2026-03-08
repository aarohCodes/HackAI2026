"""
mock_data.py - Seed the MongoDB past_learning collection with mock data.

Run directly:  python mock_data.py
"""

from db import past_learning_col

MOCK_PAST_LEARNING = [
    {
        "user_id": "user_001",
        "topic": "Python Basics",
        "subtopics": ["Variables", "Data Types", "Control Flow", "Functions"],
        "progress": 85,
        "score": 78,
        "sessions": [
            {"date": "2026-01-10", "duration_min": 45, "notes": "Covered variables and data types"},
            {"date": "2026-01-12", "duration_min": 60, "notes": "Practiced control flow with exercises"},
            {"date": "2026-01-15", "duration_min": 30, "notes": "Functions and scope"},
        ],
        "strengths": ["Variables", "Data Types"],
        "weaknesses": ["Recursion", "Lambda Functions"],
        "resources_used": [
            "https://www.youtube.com/watch?v=kqtD5dpn9C8",
            "https://docs.python.org/3/tutorial/",
        ],
    },
    {
        "user_id": "user_001",
        "topic": "Data Structures",
        "subtopics": ["Arrays", "Linked Lists", "Stacks", "Queues", "Trees", "Graphs"],
        "progress": 60,
        "score": 65,
        "sessions": [
            {"date": "2026-02-01", "duration_min": 50, "notes": "Arrays and linked lists"},
            {"date": "2026-02-05", "duration_min": 55, "notes": "Stacks and queues implementation"},
            {"date": "2026-02-10", "duration_min": 70, "notes": "Binary trees introduction"},
        ],
        "strengths": ["Arrays", "Stacks"],
        "weaknesses": ["Graphs", "Tree Traversals"],
        "resources_used": [
            "https://www.youtube.com/watch?v=8hly31xKli0",
        ],
    },
    {
        "user_id": "user_001",
        "topic": "Machine Learning",
        "subtopics": ["Linear Regression", "Logistic Regression", "Decision Trees", "Neural Networks"],
        "progress": 40,
        "score": 55,
        "sessions": [
            {"date": "2026-02-20", "duration_min": 60, "notes": "Linear regression from scratch"},
            {"date": "2026-02-25", "duration_min": 45, "notes": "Logistic regression and classification"},
        ],
        "strengths": ["Linear Regression"],
        "weaknesses": ["Neural Networks", "Back-propagation"],
        "resources_used": [
            "https://www.youtube.com/watch?v=i_LwzRVP7bg",
        ],
    },
    {
        "user_id": "user_001",
        "topic": "Web Development",
        "subtopics": ["HTML", "CSS", "JavaScript", "React", "REST APIs"],
        "progress": 72,
        "score": 70,
        "sessions": [
            {"date": "2026-01-20", "duration_min": 40, "notes": "HTML & CSS fundamentals"},
            {"date": "2026-01-25", "duration_min": 55, "notes": "JavaScript ES6 features"},
            {"date": "2026-02-02", "duration_min": 65, "notes": "React components and state"},
            {"date": "2026-02-08", "duration_min": 50, "notes": "Building REST APIs with FastAPI"},
        ],
        "strengths": ["HTML", "CSS", "REST APIs"],
        "weaknesses": ["React Hooks", "State Management"],
        "resources_used": [
            "https://www.youtube.com/watch?v=Tn6-PIqc4UM",
        ],
    },
    {
        "user_id": "user_001",
        "topic": "Database Systems",
        "subtopics": ["SQL", "NoSQL", "Normalization", "Indexing", "Transactions"],
        "progress": 50,
        "score": 60,
        "sessions": [
            {"date": "2026-03-01", "duration_min": 45, "notes": "SQL basics and joins"},
            {"date": "2026-03-04", "duration_min": 50, "notes": "MongoDB and NoSQL concepts"},
        ],
        "strengths": ["SQL Queries"],
        "weaknesses": ["Normalization", "Transactions"],
        "resources_used": [],
    },
]


def seed_data():
    """Drop existing data and insert mock past_learning records."""
    past_learning_col.delete_many({})
    result = past_learning_col.insert_many(MOCK_PAST_LEARNING)
    print(f"Inserted {len(result.inserted_ids)} mock past_learning documents.")
    return result.inserted_ids


if __name__ == "__main__":
    ids = seed_data()
    for _id in ids:
        print(f"  -> {_id}")
