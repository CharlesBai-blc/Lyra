"""
Routes for the 2nd prototype of Lyra.

Note to self- ?mode=param compares the old TF-IDF against new SVD-based recommender with default being SVD.
"""
import os
from flask import send_from_directory, request, jsonify
 
from recommender import get_recommender
from svd_recommender import get_svd_recommender
 
def register_routes(app):
    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def serve(path):
        static = app.static_folder
        if path and os.path.exists(os.path.join(static, path)):
            return send_from_directory(static, path)
        return send_from_directory(static, "index.html")
 
    @app.route("/api/config")
    def config():
        return jsonify({"prototype": "svd-v1"})
 
    @app.route("/api/recommendations")
    def recommendations():
        query = request.args.get("query", "")

        if not query.strip():
            return jsonify([])

        try:
            top_k = int(request.args.get("top_k", "10"))
        except ValueError:
            top_k = 10

        top_k = max(1, min(top_k, 25))

        matches = get_svd_recommender().recommend(
            query=query,
            top_k=top_k
        )

        return jsonify(matches)