from flask import Flask, request, jsonify
from urllib.parse import urlparse, parse_qs
import pandas as pd

app = Flask(__name__)

# get the thubmnail


def get_youtube_video_id(url):
    # Parse the URL
    parsed_url = urlparse(url)

    # Extract the video ID from the query parameters
    query_params = parse_qs(parsed_url.query)
    video_id = query_params.get("v", [None])[0]

    return video_id


# recomender system model
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import linear_kernel
from flask import Flask, request, jsonify

app = Flask(__name__)

# Load your sentiment analysis model and other necessary setup here

# Sample data for content recommender
df = pd.read_csv("content_by_metadata.csv")
metadata_column = "Metadata"

vectorizer = TfidfVectorizer()
item_matrix = vectorizer.fit_transform(df[metadata_column].astype(str))


@app.route("/contentrecommender", methods=["GET", "POST"])
def contentrecommender():
    try:
        if request.method == "GET":
            # Handle GET request with parameters through the URL
            user_input = request.args.get("user_input", "Finance, Bullying, Child")
        elif request.method == "POST":
            # Handle POST request with JSON body
            data = request.get_json(force=True)
            input_text = data["content"]
            user_input = data.get("user_input", input_text)
        else:
            return jsonify({"error": "Unsupported HTTP method"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 400

    user_vector = vectorizer.transform([user_input])

    # Your content recommender logic
    cosine_similarities = linear_kernel(user_vector, item_matrix).flatten()
    recommended_indices = cosine_similarities.argsort()[::-1][:20]
    recommended_items = df.iloc[recommended_indices][
        ["Video ID", "Title", "Author", "Views", "Likes", "Comments", "Labels"]
    ]
    result = []
    for i in range(len(recommended_items["Title"].tolist())):
        thumbnail = get_youtube_video_id(recommended_items["Video ID"].tolist()[i])
        result.append(
            {
                "Video ID": recommended_items["Video ID"].tolist()[i],
                "Title": recommended_items["Title"].tolist()[i],
                "Author": recommended_items["Author"].tolist()[i],
                "Views": recommended_items["Views"].tolist()[i],
                "Likes": recommended_items["Likes"].tolist()[i],
                "Comments": recommended_items["Comments"].tolist()[i],
                "Labels": recommended_items["Labels"].tolist()[i],
                "Thumbnail": f"https://i.ytimg.com/vi/{thumbnail}/hqdefault.jpg",
            }
        )

    result = {"result": result}

    return jsonify(result)


if __name__ == "__main__":
    app.run(debug=True)
