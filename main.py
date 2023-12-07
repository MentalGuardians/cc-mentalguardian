from flask import Flask, request, jsonify
import tensorflow as tf
import re
from nltk.tokenize import word_tokenize
from nltk.stem import PorterStemmer
from nltk.stem import WordNetLemmatizer
from tensorflow.keras.preprocessing.sequence import pad_sequences
from tensorflow.keras.preprocessing.text import Tokenizer
import pandas as pd

app = Flask(__name__)
loaded_model = tf.keras.models.load_model("./model.h5")

max_len = 500
data = pd.read_csv(
    "./sentiment_analysis_dataset.csv", encoding="ISO-8859-1", engine="python"
)
data = pd.read_csv(
    "./sentiment_analysis_dataset.csv", encoding="ISO-8859-1", engine="python"
)
data.columns = ["label", "time", "date", "query", "username", "text"]

data = data[["text", "label"]]

data["label"][data["label"] == 4] = 1

data_pos = data[data["label"] == 1]
data_neg = data[data["label"] == 0]

data_pos = data_pos.iloc[: int(500000)]
data_neg = data_neg.iloc[: int(500000)]

data = pd.concat([data_pos, data_neg])
data["text"] = data["text"].str.lower()
data["text"] = data["text"].astype(str)
X = data.text
y = data.label

max_len = 500
tok = Tokenizer(
    num_words=2000
)  # the maximum number of words to keep, based on word frequency. Only the most common num_words-1 words will be kept.
tok.fit_on_texts(X)


def cleaning_punctuations(text):
    cleaned_text = re.sub(r"[^\w\s]", "", text)
    return cleaned_text


def cleaning_repeating_char(text):
    cleaned_text = re.sub(r"(.)\1+", r"\1", text)
    return cleaned_text


def cleaning_email(text):
    cleaned_text = re.sub(r"\S+@\S+", "", text)
    return cleaned_text


def cleaning_URLs(text):
    cleaned_text = re.sub(r"http\S+", "", text)
    return cleaned_text


def cleaning_numbers(text):
    cleaned_text = re.sub(r"\d+", "", text)
    return cleaned_text


def stemming_on_text(tokens):
    stemmer = PorterStemmer()
    stemmed_tokens = [stemmer.stem(token) for token in tokens]
    return stemmed_tokens


def lemmatizer_on_text(tokens):
    lemmatizer = WordNetLemmatizer()
    lemmatized_tokens = [lemmatizer.lemmatize(token) for token in tokens]
    return lemmatized_tokens


# tok = Tokenizer(num_words=2000)


def preprocess_input_data(sentence, tokenizer, max_len):
    sequence_to_predict = sentence.lower()
    sequence_to_predict = cleaning_punctuations(sequence_to_predict)
    sequence_to_predict = cleaning_repeating_char(sequence_to_predict)
    sequence_to_predict = cleaning_email(sequence_to_predict)
    sequence_to_predict = cleaning_URLs(sequence_to_predict)
    sequence_to_predict = cleaning_numbers(sequence_to_predict)
    sequence_to_predict = word_tokenize(sequence_to_predict)
    sequence_to_predict = stemming_on_text(sequence_to_predict)
    sequence_to_predict = lemmatizer_on_text(sequence_to_predict)
    sequence_to_predict = tokenizer.texts_to_sequences([sequence_to_predict])
    sequence_to_predict = pad_sequences(sequence_to_predict, maxlen=max_len)
    return sequence_to_predict


@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json(force=True)
        input_text = data["text"]

        # Print the input text for debugging
        print("Input Text:", input_text)

        preprocessed_input = preprocess_input_data(input_text, tok, max_len)

        # Print the preprocessed input for debugging
        print("Preprocessed Input:", preprocessed_input)

        predicted_probabilities = loaded_model.predict(preprocessed_input)

        # Print the predicted probabilities for debugging
        print("Predicted Probabilities:", predicted_probabilities)

        predicted_class = "bad" if predicted_probabilities[0][0] > 0.4 else "good"
        result = {
            "prediction": predicted_class,
            "probability": float(predicted_probabilities[0][0]),
        }
        return jsonify(result)

    except Exception as e:
        return jsonify({"error": str(e)}), 400


if __name__ == "__main__":
    app.run(debug=True)
