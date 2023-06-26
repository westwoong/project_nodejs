const { Comment } = require('../models');
const { sequelize } = require('../config/database');

const getCommentByUserId = async (commentId, userId) => {
  return Comment.findOne({ where: { id: commentId, userId } });
}

const getCommentsByPostId = async (postId, limit, offset) => {
  return Comment.findAll({ where: { postId }, limit: limit, offset: offset });
};

const getCommentCountByPostId = async (postId) => {
  return Comment.count({ where: { postId } });
};

const createComment = async (userId, postId, comment) => {
  return Comment.create({ userId, postId, content: comment });
}

const deleteUserComment = async (commentId, userId) => {
  return Comment.destroy({ where: { id: commentId, userId } });
}

const deleteCommentByPostId = async (postId, transaction) => {
  return Comment.destroy({ where: { postId }, transaction });
};

const modifyCommet = async (comment, commentId, userId) => {
  return Comment.update({ content: comment }, { where: { id: commentId, userId } });
}

const getPostCommentCountByPostId = async (postId) => {
  return Comment.findAll({
    attributes: ['postId', [sequelize.fn('COUNT', sequelize.col('id')), 'comment_count']],
    where: { postId },
    group: ['postId']
  });
}

const getCommentByPostId = async (postId, limit, offset) => {
  return Comment.findAll({
    where: { postId },
    order: [['created_at', 'DESC']],
    limit,
    offset
  });
}

module.exports = {
  getCommentByUserId,
  getCommentsByPostId,
  getCommentCountByPostId,
  getPostCommentCountByPostId,
  getCommentByPostId,
  createComment,
  deleteUserComment,
  deleteCommentByPostId,
  modifyCommet
}