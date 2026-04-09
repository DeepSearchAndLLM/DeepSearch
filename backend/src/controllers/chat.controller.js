const { askQuestionForUser } = require("../services/chat.service");

async function askQuestion(req, res, next) {
  try {
    const { question } = req.body;
    const result = await askQuestionForUser({
      user: req.user,
      question,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  askQuestion,
};
