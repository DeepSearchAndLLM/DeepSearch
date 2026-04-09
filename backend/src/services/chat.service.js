const { env } = require("../config/env");
const { listDocumentsForUser } = require("./document.service");
const { badRequest, createHttpError } = require("../utils/http-errors");

async function askQuestionForUser({ user, question }) {
  if (!question || !question.trim()) {
    throw badRequest("question is required");
  }

  const documents = await listDocumentsForUser(user);
  const allowedSources = documents.map((document) => document.file_name);

  let response;
  try {
    response = await fetch(`${env.pythonApiUrl}/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question: question.trim(),
        allowed_sources: allowedSources,
      }),
    });
  } catch (error) {
    throw createHttpError(
      502,
      `Python RAG service is unreachable: ${error.message}`
    );
  }

  if (!response.ok) {
    const bodyText = await response.text();
    throw createHttpError(
      502,
      `Python RAG service returned ${response.status}: ${bodyText}`
    );
  }

  const payload = await response.json();

  return {
    question: question.trim(),
    answer: payload.answer,
    sources: payload.sources || [],
    allowedDocumentCount: allowedSources.length,
    retrievedCount: payload.retrievedCount || 0,
    usedSourceCount: payload.usedSourceCount || 0,
  };
}

module.exports = {
  askQuestionForUser,
};
