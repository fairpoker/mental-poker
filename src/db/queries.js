const INSERT_NEW_HAND_INTO_HAND_HISTORY = 'INSERT INTO hand_history (game_type, big_blind, seats, players_seated, players_sitting_in) VALUES($1, $2, $3, $4, $5) RETURNING id';
const UPDATE_INCREMENT_HANDS_PLAYED = 'UPDATE user_stats SET hands_played = hands_played + 1 WHERE userid = $1';
const INSERT_SIT_IN_INTO_TABLE_HISTORY = 'INSERT INTO table_history (time, cash_game, sit_in, userid, bb, sb, amount) VALUES(current_timestamp, TRUE, TRUE, $1, $2, $3, $4)';
const INSERT_SIT_OUT_INTO_TABLE_HISTORY = 'INSERT INTO table_history (time, cash_game, sit_in, userid, bb, sb, amount) VALUES(current_timestamp, TRUE, FALSE, $1, $2, $3, $4)';
const SELECT_BALANCE_USERNAME = 'SELECT balance, username FROM users JOIN balances ON users.id = balances.userid WHERE userid = $1';
const SELECT_BALANCE = 'SELECT balance FROM balances WHERE userid = $1';
const SELECT_UNLOCK_RAKE = 'SELECT tables_unlock_after_rake FROM no_deposit_bonus_v1 WHERE recipient = $1';
const SELECT_TOTAL_RAKE = 'SELECT COALESCE(SUM(value), 0) AS sum FROM rake_history WHERE userid = $1';
const SELECT_DEPOSIT_COUNT = 'SELECT COUNT(*) AS count FROM transactions WHERE is_deposit = true AND value >= 50000 AND is_confirmed = true AND userid = $1';
const SELECT_FROZEN_ACCOUNT = 'SELECT is_frozen FROM users WHERE id = $1';
const UPDATE_BALANCES_DECREMENT_INGAME = 'UPDATE balances SET ingame = ingame - $1 WHERE userid = $2';
const UPDATE_BALANCES_INCREMENT_ACCOUNT_DECREMENT_INGAME = 'UPDATE balances SET balance = balance + $1, ingame = ingame - $1, locked = 0 WHERE userid = $2';
const UPDATE_BALANCES_DECREMENT_ACCOUNT_INCREMENT_INGAME = 'UPDATE balances SET balance = balance - $1, ingame = ingame + $1, locked = 0 WHERE userid = $2 RETURNING balance, ingame, locked';
const SELECT_BALANCE_INGAME_LOCKED = 'SELECT balance, ingame, locked FROM balances WHERE userid = $1';
const INSERT_RAKE_HISTORY = 'INSERT INTO rake_history (value, big_blind, userid) VALUES($1, $2, $3)';
const UPDATE_BALANCES_INCREMENT_INGAME = 'UPDATE balances SET ingame = ingame + $1 WHERE userid = $2';
const UPDATE_BALANCES_DECREMENT_INGAME_AND_LOCKED = 'UPDATE balances SET ingame = ingame - $1, locked = locked - $2 WHERE userid = $3';
const INSERT_PLAYER_INTO_HAND_HISTORY = 'INSERT INTO hand_history_players (userid, hand_id) VALUES($1, $2)';
const UPDATE_HAND_HISTORY_LOG = "UPDATE hand_history SET log = CONCAT(log, $1::text, E'\n') WHERE id = $2";

module.exports = {
  INSERT_NEW_HAND_INTO_HAND_HISTORY,
  UPDATE_INCREMENT_HANDS_PLAYED,
  INSERT_SIT_IN_INTO_TABLE_HISTORY,
  INSERT_SIT_OUT_INTO_TABLE_HISTORY,
  SELECT_BALANCE_USERNAME,
  SELECT_BALANCE,
  SELECT_TOTAL_RAKE,
  SELECT_UNLOCK_RAKE,
  SELECT_FROZEN_ACCOUNT,
  SELECT_DEPOSIT_COUNT,
  UPDATE_BALANCES_DECREMENT_INGAME,
  UPDATE_BALANCES_INCREMENT_ACCOUNT_DECREMENT_INGAME,
  UPDATE_BALANCES_DECREMENT_ACCOUNT_INCREMENT_INGAME,
  INSERT_RAKE_HISTORY,
  UPDATE_BALANCES_INCREMENT_INGAME,
  UPDATE_BALANCES_DECREMENT_INGAME_AND_LOCKED,
  INSERT_PLAYER_INTO_HAND_HISTORY,
  UPDATE_HAND_HISTORY_LOG,
  SELECT_BALANCE_INGAME_LOCKED,
};
