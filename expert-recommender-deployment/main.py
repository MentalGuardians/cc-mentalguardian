from flask import Flask, request, jsonify

app = Flask(__name__)

# recomender system model
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import linear_kernel

df = pd.read_csv("https://storage.googleapis.com/therapist-recommender-data-bucket/Mental_Health.csv")
metadata_column = "Metadata"


@app.route("/expertrecommender", methods=["GET", "POST"])
def expertrecommender():
    try:
        if request.method == "GET":
            # Handle GET request with parameters through the URL
            user_input = request.args.get("user_input", "Sexual, Female, Psychologist")
        elif request.method == "POST":
            # Handle POST request with JSON body
            data = request.get_json(force=True)
            input_text = data["expert"]
            user_input = data.get("user_input", input_text)
        else:
            return jsonify({"error": "Unsupported HTTP method"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 400

    vectorizer = TfidfVectorizer()
    item_matrix = vectorizer.fit_transform(df[metadata_column].astype(str))
    user_vector = vectorizer.transform([user_input])

    cosine_similarities = linear_kernel(user_vector, item_matrix).flatten()
    recommended_indices = cosine_similarities.argsort()[::-1][:20]
    recommended_items = df.iloc[recommended_indices][
        [
            "Name",
            "Age",
            "Status",
            "Price",
            "Methods",
            "User Viewed",
            "Rating",
            "Category",
            "Domicile",
            "Gender",
            "Metadata",
        ]
    ]
    # -----------------------------------------------------
    result = []
    for i in range(len(recommended_items["Status"].tolist())):
        result.append(
            {
                "Name": recommended_items["Name"].tolist()[i],
                "Age": recommended_items["Age"].tolist()[i],
                "Status": recommended_items["Status"].tolist()[i],
                "Price": recommended_items["Price"].tolist()[i],
                "Methods": recommended_items["Methods"].tolist()[i],
                "User Viewed": recommended_items["User Viewed"].tolist()[i],
                "Rating": recommended_items["Rating"].tolist()[i],
                "Category": recommended_items["Category"].tolist()[i],
                "Domicile": recommended_items["Domicile"].tolist()[i],
                "Gender": recommended_items["Gender"].tolist()[i],
            }
        )

    result = {"result": result}

    return jsonify(result)


if __name__ == "__main__":
    app.run(debug=True)
