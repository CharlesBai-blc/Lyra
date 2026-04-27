
import json
import os
import re
import logging
from flask import request, jsonify
from infosci_spark_client import LLMClient

logger = logging.getLogger(__name__)


def llm_expand_query(client, user_message):
    messages = [
        {
            "role": "system",
            "content": (
                "You are a search query optimizer for a music lyric search engine. "
                "Given the user's input, rewrite it as a compact set of keywords that captures the mood, theme, and feeling — words likely to appear in matching song lyrics. "
                "Rules:\n"
                "- If the input is short (1-3 words), expand it into closely related descriptive words. Be sure to include the original words in the expansion and don't stray too far"
                +" from the original word meanings. \n"
                "- If the input is long, distill it down to the most important mood and theme keywords.\n"
                "- If the input references a cultural moment, feeling, or situation, translate it into the emotions and words a matching song would contain.\n"
                "- Output only keywords, space-separated, no punctuation, no explanation. Aim for 5-10 words.\n"
                "Examples:\n"
                "  'christmas' -> 'christmas winter festive merry cozy warm holiday joy'\n"
                "  'shake off haters' -> 'shake confident carefree upbeat haters brushing off empowerment'\n"
                "  'i want something that feels like a warm summer evening with friends laughing' -> 'summer warm evening friends joy laughter carefree nostalgic'"
                "  'mad' -> 'angry aggressive frustrated bitter resentment rage furious vengeful'"
            ),
        },
        {"role": "user", "content": user_message},
    ]
    response = client.chat(messages)
    expanded = (response.get("content") or "").strip()
    logger.info(f"LLM query expansion: {expanded}")
    print(f"[RAG] expanded query: {expanded}", flush=True)
    return expanded or user_message


def llm_describe_songs(client, user_query, songs):
    if not songs:
        return []

    song_list = "\n".join(
        f"{i+1}. \"{s['title']}\" by {s['artist']} — {s['lyrics_preview']}"
        for i, s in enumerate(songs)
    )

    messages = [
        {
            "role": "system",
            "content": (
                "You are a music assistant. For each song listed, write a paragraph of 3-6 sentences "
                "explaining why it fits the user's request — cover the mood, lyrical themes, and how it connects to what the user is looking for. "
                "Output only the numbered list, nothing else. Format:\n"
                "1. <paragraph>\n2. <paragraph>\n..."
            ),
        },
        {
            "role": "user",
            "content": f"User's request: {user_query}\n\nSongs:\n{song_list}",
        },
    ]

    response = client.chat(messages)
    content = (response.get("content") or "").strip()

    descriptions = [""] * len(songs)
    for match in re.finditer(r"(\d+)\.\s*(.+?)(?=\n\d+\.|$)", content, re.DOTALL):
        idx = int(match.group(1)) - 1
        if 0 <= idx < len(songs):
            descriptions[idx] = match.group(2).strip()

    return descriptions


def register_chat_route(app, song_search):

    @app.route("/api/rag", methods=["POST"])
    def rag():
        data = request.get_json() or {}
        user_query = (data.get("query") or "").strip()
        skip_expansion = data.get("skip_expansion", False)
        
        if not user_query:
            return jsonify({"error": "Query is required"}), 400

        api_key = os.getenv("SPARK_API_KEY")
        if not api_key:
            return jsonify({"error": "SPARK_API_KEY not set"}), 500

        client = LLMClient(api_key=api_key)

        # skip expansion for SVD mode
        if skip_expansion:
            expanded_query = user_query
        else:
            expanded_query = llm_expand_query(client, user_query)

        songs = song_search(expanded_query)
        descriptions = llm_describe_songs(client, user_query, songs)
        summary = llm_summarize_results(client, user_query, songs)

        return jsonify({
            "songs": songs,
            "descriptions": descriptions,
            "expanded_query": expanded_query,
            "summary": summary  
        })
    

def llm_summarize_results(client, user_query, songs):
    if not songs:
        return ""

    song_list = "\n".join(
        f"{i+1}. \"{s['title']}\" by {s['artist']} — {s['lyrics_preview']}"
        for i, s in enumerate(songs)
    )

    messages = [
        {
            "role": "system",
            "content": (
                "You are a music assistant. Given a user's emotional request and a list of matching songs, "
                "write a single cohesive paragraph (4-6 sentences) that summarizes why these songs were chosen as a collection. "
                "Talk about the shared mood, themes, and emotional throughline across the results. "
                "Don't list songs individually — speak about them as a curated set."
            ),
        },
        {
            "role": "user",
            "content": f"User's request: {user_query}\n\nRetrieved songs:\n{song_list}",
        },
    ]

    response = client.chat(messages)
    return (response.get("content") or "").strip()