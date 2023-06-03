import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import aposToLexForm from "apos-to-lex-form";
import natural from "natural";
import SpellCorrector from "spelling-corrector";
import sw from "stopword";
import dotenv from "dotenv";
import logger from "./helpers/logger.js";

dotenv.config();

// Enviroment variables
const NODE_ENV = process.env?.NODE_ENV != null ? process.env?.NODE_ENV : "dev";
const PORT = Number(process.env.PORT) || 8000;

const spellCheck = new SpellCorrector();
spellCheck.loadDictionary();

const app = express();

app.use(express.json());
app.use(helmet());
app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" }));
app.use(cors());
app.use(morgan(NODE_ENV === "prod" ? "combined" : "dev"));

app.post("/sentify", async (req, res) => {
  const { text } = req.body;
  if (!text) {
    return res.json({
      message: "Text is required in order to do the sentiment analysis",
      statusCode: 400,
    });
  }

  const lexedText = aposToLexForm(text);
  const casedText = lexedText.toLowerCase();
  const alphaOnlyText = casedText.replace(/[^a-zA-Z\s]+/g, "");

  const { WordTokenizer } = natural;
  const tokenizer = new WordTokenizer();
  const tokenizedText = tokenizer.tokenize(alphaOnlyText);

  tokenizedText.forEach((word, index) => {
    tokenizedText[index] = spellCheck.correct(word);
  });
  const filteredText = sw.removeStopwords(tokenizedText);

  const { SentimentAnalyzer, PorterStemmer } = natural;
  const analyzer = new SentimentAnalyzer("English", PorterStemmer, "afinn");
  const analysis = analyzer.getSentiment(filteredText);

  let status;
  if (analysis < 0) {
    status = "negative";
  } else if (analysis === 0) {
    status = "neutral";
  } else if (analysis > 0) {
    status = "positive";
  }

  res.status(200).json({ analysis, status });
});

app.listen(PORT, () => {
  logger.info(`Server started on port ${PORT}`);
});
