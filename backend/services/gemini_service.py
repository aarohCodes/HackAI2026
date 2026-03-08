from google import genai
import json
import os
import logging
import time
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
MODEL = "gemini-2.5-flash"

FALLBACK_RECOMMENDATION = {
    "top_concept": "unknown",
    "reasoning": "Gemini is temporarily unavailable. Please review your weakest concepts manually.",
    "practice_scenario": "Review your notes on the flagged concept for 10 minutes.",
    "youtube_query": "",
    "timestamp_hint": "",
    "learning_mode": "quick",
    "_fallback": True,
}


def _safe_parse_json(text: str) -> dict | None:
    """Strip markdown fences and parse JSON."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        first_nl = cleaned.find("\n")
        if first_nl != -1:
            cleaned = cleaned[first_nl + 1:]
    if cleaned.endswith("```"):
        cleaned = cleaned.rsplit("```", 1)[0]
    cleaned = cleaned.strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return None


def _call_gemini_once(prompt: str) -> dict | None:
    """Single Gemini call with 429 backoff (up to 3 retries)."""
    for attempt in range(4):
        try:
            response = client.models.generate_content(
                model=MODEL,
                contents=prompt,
            )
            text = getattr(response, "text", None)
            if not text or not str(text).strip():
                logger.warning("Gemini returned empty text")
                return None
            return _safe_parse_json(str(text).strip())
        except Exception as e:
            err_str = str(e).lower()
            if "429" in err_str or "resource" in err_str or "rate" in err_str:
                wait = 2 ** attempt
                logger.warning("Gemini 429 rate limit, backing off %ds (attempt %d)", wait, attempt + 1)
                time.sleep(wait)
                continue
            logger.error("Gemini API error: %s", e)
            return None
    logger.error("Gemini still rate-limited after retries")
    return None


def _call_gemini(prompt: str, retry_strict: bool = True) -> dict | None:
    """Call Gemini with 429 backoff + optional retry on invalid JSON."""
    result = _call_gemini_once(prompt)
    if result is not None:
        return result

    if retry_strict:
        logger.warning("Gemini returned invalid JSON, retrying with strict prefix")
        strict_prompt = (
            "IMPORTANT: Return ONLY valid JSON. No markdown, no backticks, no extra text.\n\n"
            + prompt
        )
        result = _call_gemini_once(strict_prompt)
        if result is not None:
            return result

    logger.error("Gemini failed to return valid JSON after retry")
    return None


def build_recommendation(
    user_profile: dict, decaying_nodes: list, recent_signals: list
) -> dict:
    prompt = f"""You are a personalized learning coach AI inside Cortex.

USER PROFILE:
- Goal: {user_profile['goal']}
- Background: {user_profile['background']}
- Learner Type: {user_profile.get('learner_type', 'unknown')}

CONCEPTS TO REVIEW (these need attention based on current retention):
{json.dumps(decaying_nodes, indent=2)}

RECENT BEHAVIORAL SIGNALS:
{json.dumps(recent_signals, indent=2)}

Your task: Respond with ONLY a valid JSON object (no markdown, no backticks):
  {{
    "top_concept": "<the single most urgent concept to address>",
    "reasoning": "<2-3 sentences explaining WHY this concept is at risk>",
    "practice_scenario": "<a concrete practice task for 10 minutes>",
    "youtube_query": "<precise 4-6 word search query for this gap>",
    "timestamp_hint": "<describe what ideal video segment covers>",
    "learning_mode": "<one of: teach / defend / connect / quick>"
  }}"""

    result = _call_gemini(prompt)
    return result or FALLBACK_RECOMMENDATION


def evaluate_feynman(
    concept: str, user_explanation: str, user_background: str
) -> dict:
    prompt = f"""You are evaluating a learner's explanation of a concept using the Feynman Technique.

CONCEPT: {concept}
LEARNER BACKGROUND: {user_background}
LEARNER'S EXPLANATION: {user_explanation}

Respond ONLY with valid JSON:
  {{
    "score": <float 0.0 to 1.0>,
    "correct_parts": "<what they explained well>",
    "gap_identified": "<the precise gap in their understanding>",
    "gap_fill": "<clear explanation filling exactly that gap - 2-4 sentences>"
  }}"""

    result = _call_gemini(prompt)
    if result is None:
        return {
            "score": 0.5,
            "correct_parts": "Unable to evaluate at this time.",
            "gap_identified": "Please try again.",
            "gap_fill": "Gemini is temporarily unavailable.",
            "_fallback": True,
        }
    return result


def socratic_open(concept: str, user_background: str) -> dict:
    prompt = f"""You are a Socratic tutor. Take a specific, debatable position about:
CONCEPT: {concept}
LEARNER BACKGROUND: {user_background}

Respond ONLY with valid JSON:
  {{
    "position": "<a clear, arguable claim about this concept>",
    "opening_challenge": "<1-2 sentences challenging the learner to respond>"
  }}"""

    result = _call_gemini(prompt)
    if result is None:
        return {
            "position": f"Understanding {concept} is essential but often misunderstood.",
            "opening_challenge": f"Can you explain why {concept} matters in practice?",
            "_fallback": True,
        }
    return result


def socratic_reply(
    concept: str, position: str, history: list, user_reply: str
) -> dict:
    conversation = "\n".join(
        [f"{m['role']}: {m['content']}" for m in history]
    )
    prompt = f"""Concept: {concept}. Your position: {position}.
Conversation so far: {conversation}
Learner just said: {user_reply}

Respond ONLY with valid JSON:
  {{
    "pushback": "<push back, probe deeper, expose a nuance they missed>",
    "misconception_caught": true or false,
    "misconception_detail": "<what misconception was exposed?>"
  }}"""

    result = _call_gemini(prompt)
    if result is None:
        return {
            "pushback": "Interesting point. Can you elaborate further?",
            "misconception_caught": False,
            "misconception_detail": "",
            "_fallback": True,
        }
    return result


def generate_quick_snapshot(concept: str, user_background: str) -> dict:
    prompt = f"""Generate a 30-second micro-challenge for this concept: {concept}
Learner background: {user_background}
Respond ONLY with valid JSON:
  {{
    "question": "<a specific, answerable question>",
    "ideal_answer_points": ["point1", "point2"]
  }}"""

    result = _call_gemini(prompt)
    if result is None:
        return {
            "question": f"In your own words, what is {concept}?",
            "ideal_answer_points": ["Core definition", "Practical application"],
            "_fallback": True,
        }
    return result


def _topic_to_domain(topic: str) -> str:
    """Convert a topic name to a domain slug (e.g. 'Machine Learning' -> 'machine_learning')."""
    return topic.strip().lower().replace(" ", "_").replace("-", "_").replace("/", "_") or "general"


ONBOARDING_PROMPT = """You are initializing a personalized knowledge graph for a new learner on Cortex, an AI-powered adaptive learning platform.

LEARNER TOPICS OF INTEREST (each must become its own hub/domain): {topics}
REQUIRED DOMAIN VALUES (use these EXACT strings for the "domain" field): {topics_list}
LEARNER GOAL: {goal}
LEARNER BACKGROUND: {background}
PRIOR LEARNING HISTORY: {prior_history}

IMPORTANT: You MUST create nodes for EACH of the topics above separately.
- Use EXACTLY the domain values from "REQUIRED DOMAIN VALUES" for the "domain" field — one domain per topic.
- Each domain MUST have at least 4 nodes (sub-concepts). So if there are 3 topics, you need at least 12 nodes total.
- Total graph: 15-25+ concepts covering ALL topics. Concepts MUST be specific to each topic.

Rules:
- Concepts the learner already knows based on their background -> state: 'green'
- Concepts they partially know or have some exposure to -> state: 'yellow'
- Concepts they need to learn -> state: 'red'
- complexity_tier: 1=fundamental, 2=intermediate, 3=advanced
- dependency_depth: how many prerequisite hops from the root concept
- canvas_x, canvas_y: arrange left-to-right, x from 100 to 1600 spacing ~150-200px, y around 0 with +/-200 spread
- edges: prerequisite edges from simpler to harder concepts (can link within same domain or across)
- Every concept name should be specific (e.g., "Gradient Descent" not "Math")

Return ONLY valid JSON (no markdown fences, no extra text):
{{
  "nodes": [
    {{
      "concept": "string",
      "domain": "string",
      "state": "red|yellow|green",
      "complexity_tier": 1,
      "dependency_depth": 0,
      "canvas_x": 0.0,
      "canvas_y": 0.0
    }}
  ],
  "edges": [
    {{ "from": "concept_name", "to": "concept_name", "type": "prerequisite" }}
  ]
}}"""


def generate_onboarding_graph(
    goal: str, background: str, prior_history: str = "", topics: list[str] = None
) -> dict | None:
    """Generate a personalized knowledge graph via Gemini. Returns graph data or a fallback."""
    topics = topics or []
    topics_str = ", ".join(topics) if topics else goal
    topics_list = ", ".join(_topic_to_domain(t) for t in topics) if topics else _topic_to_domain(goal)
    prompt = ONBOARDING_PROMPT.format(
        topics=topics_str,
        topics_list=topics_list,
        goal=goal,
        background=background,
        prior_history=prior_history or "None provided",
    )

    result = _call_gemini(prompt)

    if result and "nodes" in result and len(result["nodes"]) >= 5:
        # Post-process: ensure each topic has at least one node (domain)
        required_domains = [_topic_to_domain(t) for t in topics] if topics else []
        existing_domains = {n.get("domain", "").strip().lower().replace(" ", "_") for n in result["nodes"]}
        nodes = list(result["nodes"])
        edges = list(result.get("edges", []))
        base_x = 100
        for topic in topics:
            domain_slug = _topic_to_domain(topic)
            if domain_slug not in existing_domains:
                # Add 4 stub nodes for this topic so it appears as its own hub
                for i, (label, state) in enumerate([
                    (f"Introduction to {topic}", "yellow"),
                    (f"Core concepts of {topic}", "red"),
                    (f"Practice {topic}", "red"),
                    (f"Advanced {topic}", "red"),
                ]):
                    nodes.append({
                        "concept": label,
                        "domain": domain_slug,
                        "state": state,
                        "complexity_tier": min(3, i + 1),
                        "dependency_depth": i,
                        "canvas_x": base_x + i * 200,
                        "canvas_y": (i % 2) * 80 - 40,
                    })
                    if i > 0:
                        edges.append({
                            "from": nodes[-2]["concept"],
                            "to": label,
                            "type": "prerequisite",
                        })
                base_x += 800
                existing_domains.add(domain_slug)
                logger.info("Added stub nodes for missing domain: %s", domain_slug)
        result = {"nodes": nodes, "edges": edges, **{k: v for k, v in result.items() if k not in ("nodes", "edges")}}
        logger.info("Gemini onboarding graph generated: %d nodes, %d edges",
                   len(result["nodes"]), len(result.get("edges", [])))
        return result

    logger.warning("Gemini onboarding returned insufficient data, generating fallback graph for goal: %s", goal)
    return _build_fallback_graph(goal, background, topics)


def _build_fallback_graph(goal: str, background: str, topics: list[str] = None) -> dict:
    """Build a reasonable starter graph when Gemini fails. One hub per topic if topics provided."""
    topics = topics or []
    if not topics:
        topics = [goal] if goal else ["General Learning"]
    nodes = []
    edges = []
    for topic_idx, topic in enumerate(topics):
        domain = _topic_to_domain(topic)
        base_x = 100 + topic_idx * 900
        topic_nodes = [
            {"concept": f"Introduction to {topic}", "domain": domain, "state": "yellow",
             "complexity_tier": 1, "dependency_depth": 0, "canvas_x": base_x, "canvas_y": 0},
            {"concept": f"Core {topic}", "domain": domain, "state": "red",
             "complexity_tier": 1, "dependency_depth": 0, "canvas_x": base_x, "canvas_y": -100},
            {"concept": f"Practice {topic}", "domain": domain, "state": "red",
             "complexity_tier": 2, "dependency_depth": 1, "canvas_x": base_x + 200, "canvas_y": -50},
            {"concept": f"Advanced {topic}", "domain": domain, "state": "red",
             "complexity_tier": 3, "dependency_depth": 2, "canvas_x": base_x + 400, "canvas_y": 0},
        ]
        nodes.extend(topic_nodes)
        edges.extend([
            {"from": topic_nodes[0]["concept"], "to": topic_nodes[2]["concept"], "type": "prerequisite"},
            {"from": topic_nodes[1]["concept"], "to": topic_nodes[2]["concept"], "type": "prerequisite"},
            {"from": topic_nodes[2]["concept"], "to": topic_nodes[3]["concept"], "type": "prerequisite"},
        ])
    return {"nodes": nodes, "edges": edges, "_fallback": True}


def generate_adaptive_quiz(concepts: list[dict], user_background: str, difficulty: str = "mixed") -> dict:
    """Generate a NotebookLM-style adaptive quiz from the user's knowledge graph."""
    prompt = f"""You are a world-class assessment designer for an adaptive learning platform called Cortex.

LEARNER BACKGROUND: {user_background}
DIFFICULTY PREFERENCE: {difficulty}

CONCEPTS FROM THEIR KNOWLEDGE GRAPH (with current mastery state):
{json.dumps(concepts, indent=2)}

Generate an adaptive quiz with exactly 10 questions. The quiz should feel like NotebookLM's 
interactive quizzes — diverse question types, contextual, and genuinely testing understanding 
not just recall.

RULES:
- Mix question types: multiple_choice, true_false, fill_blank, ordering, code_trace
- Weight more questions toward concepts with lower mastery (red/yellow/fading states)
- Green concepts: 1-2 review questions to confirm retention
- Each question must reference a specific concept from the list
- Multiple choice must have exactly 4 options with one correct answer
- Difficulty should match the concept's complexity_tier
- Include a brief explanation for each correct answer

Respond ONLY with valid JSON:
{{
  "quiz_title": "<creative quiz title>",
  "total_questions": 10,
  "estimated_minutes": <int>,
  "questions": [
    {{
      "id": 1,
      "type": "multiple_choice",
      "concept": "<concept name>",
      "difficulty": "easy|medium|hard",
      "question": "<the question text>",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correct_answer": "A",
      "explanation": "<why this is correct — 1-2 sentences>"
    }},
    {{
      "id": 2,
      "type": "true_false",
      "concept": "<concept name>",
      "difficulty": "easy|medium|hard",
      "question": "<statement to evaluate>",
      "correct_answer": "true",
      "explanation": "<why>"
    }},
    {{
      "id": 3,
      "type": "fill_blank",
      "concept": "<concept name>",
      "difficulty": "medium",
      "question": "<sentence with ___ blank>",
      "correct_answer": "<expected word or phrase>",
      "accept_alternatives": ["<alt1>", "<alt2>"],
      "explanation": "<why>"
    }},
    {{
      "id": 4,
      "type": "ordering",
      "concept": "<concept name>",
      "difficulty": "hard",
      "question": "<put these steps in the correct order>",
      "items": ["step1", "step2", "step3", "step4"],
      "correct_order": [2, 0, 3, 1],
      "explanation": "<why this order>"
    }},
    {{
      "id": 5,
      "type": "code_trace",
      "concept": "<concept name>",
      "difficulty": "hard",
      "question": "<what does this code output?>",
      "code_snippet": "<2-5 lines of code>",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correct_answer": "B",
      "explanation": "<step by step trace>"
    }}
  ]
}}"""

    result = _call_gemini(prompt)
    if result is None:
        return {
            "quiz_title": "Knowledge Check",
            "total_questions": 0,
            "estimated_minutes": 0,
            "questions": [],
            "_fallback": True,
        }
    return result


def generate_scenario_challenge(concept: str, user_background: str, related_concepts: list[str]) -> dict:
    """Generate a real-world scenario simulation like NotebookLM's deep-dive exercises."""
    prompt = f"""You are creating an immersive real-world scenario challenge for an adaptive learning platform.

FOCUS CONCEPT: {concept}
RELATED CONCEPTS: {', '.join(related_concepts)}
LEARNER BACKGROUND: {user_background}

Create a realistic, multi-step scenario that puts the learner into a professional situation where 
they must apply their knowledge of {concept}. Think like a case study from a top university — 
specific, contextual, with real stakes.

Respond ONLY with valid JSON:
{{
  "scenario_title": "<engaging scenario title>",
  "setting": "<1-2 sentences describing the real-world context>",
  "your_role": "<who the learner is in this scenario>",
  "stakes": "<what happens if they get it wrong>",
  "steps": [
    {{
      "step": 1,
      "situation": "<describe what's happening — 2-3 sentences>",
      "question": "<what should the learner do or decide?>",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correct_answer": "B",
      "consequence_correct": "<what happens if they choose right>",
      "consequence_wrong": "<what happens if they choose wrong>",
      "concept_tested": "<which concept this tests>"
    }}
  ],
  "debrief": "<2-3 sentences summarizing what this scenario taught>"
}}

Generate exactly 5 steps that build on each other, increasing in complexity."""

    result = _call_gemini(prompt)
    if result is None:
        return {
            "scenario_title": f"Applied {concept}",
            "setting": "Scenario generation temporarily unavailable.",
            "your_role": "Learner",
            "stakes": "",
            "steps": [],
            "debrief": "",
            "_fallback": True,
        }
    return result


def generate_concept_drill(concepts: list[dict], user_background: str) -> dict:
    """Generate rapid-fire drill questions targeting the weakest concepts."""
    prompt = f"""You are generating rapid-fire drill exercises for an adaptive learning platform.

LEARNER BACKGROUND: {user_background}

WEAK CONCEPTS (these need reinforcement):
{json.dumps(concepts, indent=2)}

Generate 15 rapid-fire drill questions. These should be quick to answer (< 15 seconds each),
testing core understanding. Think flashcard-style but smarter.

RULES:
- Only multiple_choice and true_false types
- Focus on the most fundamental aspect of each concept
- Questions should be answerable without deep thinking — testing recall and intuition
- 4 options for multiple choice

Respond ONLY with valid JSON:
{{
  "drill_title": "<title>",
  "total_questions": 15,
  "time_limit_seconds": 225,
  "questions": [
    {{
      "id": 1,
      "type": "multiple_choice",
      "concept": "<concept name>",
      "question": "<short, punchy question>",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correct_answer": "C",
      "explanation": "<one sentence>"
    }}
  ]
}}"""

    result = _call_gemini(prompt)
    if result is None:
        return {
            "drill_title": "Concept Drill",
            "total_questions": 0,
            "time_limit_seconds": 0,
            "questions": [],
            "_fallback": True,
        }
    return result


def grade_open_answer(concept: str, question: str, user_answer: str, correct_answer: str) -> dict:
    """Grade a fill-in-the-blank or open-ended answer using Gemini."""
    prompt = f"""You are grading a learner's answer.

CONCEPT: {concept}
QUESTION: {question}
EXPECTED ANSWER: {correct_answer}
LEARNER'S ANSWER: {user_answer}

Respond ONLY with valid JSON:
{{
  "is_correct": true or false,
  "score": <float 0.0 to 1.0, with partial credit>,
  "feedback": "<specific feedback on their answer — 1-2 sentences>"
}}"""

    result = _call_gemini(prompt)
    if result is None:
        return {"is_correct": False, "score": 0.0, "feedback": "Unable to grade at this time."}
    return result


ADD_TOPIC_PROMPT = """You are expanding a learner's knowledge graph with a new topic.

NEW TOPIC: {topic}
LEARNER BACKGROUND: {background}
EXISTING CONCEPTS: {existing}

Generate 5-10 concept nodes for this new topic that complement the learner's existing knowledge.

Rules:
- All new nodes start with state: 'red' (needs learning)
- complexity_tier: 1=fundamental, 2=intermediate, 3=advanced
- dependency_depth: relative to this topic's root
- canvas_x: start from {start_x} going right, spacing ~200px apart
- canvas_y: centered around {start_y} with +/-150 spread
- Include prerequisite edges between the new concepts
- If any existing concepts are prerequisites, include edges from them

Return ONLY valid JSON:
{{
  "nodes": [
    {{
      "concept": "string",
      "domain": "string",
      "state": "red",
      "complexity_tier": 1,
      "dependency_depth": 0,
      "canvas_x": 0.0,
      "canvas_y": 0.0
    }}
  ],
  "edges": [
    {{ "from": "concept_name", "to": "concept_name", "type": "prerequisite" }}
  ]
}}"""


def _build_add_topic_fallback(topic: str, start_x: float, start_y: float) -> dict:
    """Fallback node set when Gemini fails for add-topic."""
    domain = _topic_to_domain(topic)
    nodes = [
        {"concept": f"Introduction to {topic}", "domain": domain, "state": "red", "complexity_tier": 1, "dependency_depth": 0, "canvas_x": start_x, "canvas_y": start_y},
        {"concept": f"Core concepts of {topic}", "domain": domain, "state": "red", "complexity_tier": 1, "dependency_depth": 0, "canvas_x": start_x + 200, "canvas_y": start_y - 60},
        {"concept": f"Key skills in {topic}", "domain": domain, "state": "red", "complexity_tier": 2, "dependency_depth": 1, "canvas_x": start_x + 400, "canvas_y": start_y + 40},
        {"concept": f"Practice {topic}", "domain": domain, "state": "red", "complexity_tier": 2, "dependency_depth": 1, "canvas_x": start_x + 600, "canvas_y": start_y - 40},
        {"concept": f"Advanced {topic}", "domain": domain, "state": "red", "complexity_tier": 3, "dependency_depth": 2, "canvas_x": start_x + 800, "canvas_y": start_y},
    ]
    edges = [
        {"from": nodes[0]["concept"], "to": nodes[1]["concept"], "type": "prerequisite"},
        {"from": nodes[0]["concept"], "to": nodes[2]["concept"], "type": "prerequisite"},
        {"from": nodes[1]["concept"], "to": nodes[3]["concept"], "type": "prerequisite"},
        {"from": nodes[2]["concept"], "to": nodes[4]["concept"], "type": "prerequisite"},
        {"from": nodes[3]["concept"], "to": nodes[4]["concept"], "type": "prerequisite"},
    ]
    return {"nodes": nodes, "edges": edges}


def generate_topic_nodes(
    topic: str, background: str, existing_concepts: list[str],
    start_x: float = 0, start_y: float = 0,
) -> dict | None:
    prompt = ADD_TOPIC_PROMPT.format(
        topic=topic,
        background=background,
        existing=", ".join(existing_concepts[:20]) if existing_concepts else "None yet",
        start_x=start_x,
        start_y=start_y,
    )
    result = _call_gemini(prompt)
    if result and isinstance(result.get("nodes"), list) and len(result["nodes"]) >= 1:
        return result
    logger.warning("Add-topic Gemini returned no/invalid nodes, using fallback for: %s", topic)
    return _build_add_topic_fallback(topic, start_x, start_y)
