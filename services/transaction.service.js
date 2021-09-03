/* eslint-disable radix */
const crypto = require('crypto');
const httpStatus = require('http-status');
const config = require('../config/config');
// eslint-disable-next-line import/order
const paystack = require('paystack')(config.paystack);
const User = require('../models/user.model');
const Transaction = require('../models/transaction.model');
const userService = require('./user.service');
const transactionService = require('./transaction.service');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');

/**
 *
 * @param {string} user
 * @param {string} money
 * @returns {Promise<User>}
 */

const transfer = async (user, money, email) => {
  const transactionId = crypto.randomBytes(2).toString('hex');

  try {
    const { balance } = await userService.getCurrentAmountById(user.id);
    if (balance < money) {
      throw new ApiError(httpStatus.UNAUTHORIZED, `Insufficient funds`);
    }

    // Update my balance
    const newBalance = balance - money;
    await User.findByIdAndUpdate(
      user.id,
      { balance: newBalance },
      {
        useFindAndModify: false,
        new: true,
      }
    );

    // Update third-party balance
    const emailExists = await userService.getUserByEmail(email);
    if (!emailExists) {
      throw new ApiError(httpStatus.UNAUTHORIZED, `Depositor doesn't exist`);
    }
    const details = await userService.getCurrentAmountByEmail(email);
    const newBalanceForOtherUser = parseInt(details.balance) + parseInt(money);
    await User.findOneAndUpdate({ email }, { balance: newBalanceForOtherUser });

    const transaction = new Transaction({
      transactionId,
      operation: 'transfer',
      amount: money,
    });
    await transaction.save();
    if (!transaction) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'Unable to record Transaction failed');
    }
    return { transaction };
  } catch (error) {
    logger.error(error);
  }
};

/**
 *
 * @param {string} user
 * @param {string} money
 * @returns {Promise<User>}
 */

const getTransactions = async (user) => {
  try {
    const foundUser = await userService.getUserById(user.id);
    if (!foundUser) {
      throw new ApiError(httpStatus.UNAUTHORIZED, `User not found`);
    }
    const { operation, amount, transactionId } = await Transaction.findById(user.id);
    return { amount, operation, transactionId };
  } catch (error) {
    logger.error(error);
  }
};

module.exports = {
  transfer,
  getTransactions,
};
