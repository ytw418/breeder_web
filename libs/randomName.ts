import { USERNAME_ADJECTIVES, USERNAME_PRONOUNS } from "@libs/constants";

const generateRandomNumber = (maxNum?: number) => {
  if (!maxNum) return "";
  return Math.floor(Math.random() * maxNum + 1).toString();
};

export const randomUsername = ({
  maxNum = 0,
  maxLength,
}: {
  maxNum?: number;
  maxLength?: number;
}) => {
  const adjective =
    USERNAME_ADJECTIVES[Math.floor(Math.random() * USERNAME_ADJECTIVES.length)];
  const pronoun =
    USERNAME_PRONOUNS[Math.floor(Math.random() * USERNAME_PRONOUNS.length)];
  const number = generateRandomNumber(maxNum);

  if (maxLength) {
    return (adjective + pronoun + number).substring(0, maxLength);
  }
  return adjective + pronoun + number;
};
