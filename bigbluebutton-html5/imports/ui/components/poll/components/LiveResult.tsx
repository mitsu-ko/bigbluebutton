import { useMutation } from '@apollo/client';
import React, { useCallback } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import Session from '/imports/ui/services/storage/in-memory';
import {
  Bar, BarChart, ResponsiveContainer, XAxis, YAxis,
} from 'recharts';
import Styled from '../styles';
import {
  ResponseInfo,
  UserInfo,
  getCurrentPollData,
  getCurrentPollDataResponse,
} from '../queries';
import logger from '/imports/startup/client/logger';
import { getSettingsSingletonInstance } from '/imports/ui/services/settings';
import { POLL_CANCEL, POLL_PUBLISH_RESULT } from '../mutations';
import { layoutDispatch } from '../../layout/context';
import { ACTIONS, PANELS } from '../../layout/enums';
import useDeduplicatedSubscription from '/imports/ui/core/hooks/useDeduplicatedSubscription';
import CustomizedAxisTick from './CustomizedAxisTick';
import connectionStatus from '/imports/ui/core/graphql/singletons/connectionStatus';
import Tooltip from '../../common/tooltip/component';

const intlMessages = defineMessages({
  usersTitle: {
    id: 'app.poll.liveResult.usersTitle',
    description: 'heading label for poll users',
  },
  responsesTitle: {
    id: 'app.poll.liveResult.responsesTitle',
    description: 'heading label for poll responses',
  },
  publishLabel: {
    id: 'app.poll.publishLabel',
    description: 'label for the publish button',
  },
  cancelPollLabel: {
    id: 'app.poll.cancelPollLabel',
    description: 'label for cancel poll button',
  },
  backLabel: {
    id: 'app.poll.backLabel',
    description: 'label for the return to poll options button',
  },
  doneLabel: {
    id: 'app.createBreakoutRoom.doneLabel',
    description: 'label shown when all users have responded',
  },
  waitingLabel: {
    id: 'app.poll.waitingLabel',
    description: 'label shown while waiting for responses',
  },
  secretPollLabel: {
    id: 'app.poll.liveResult.secretLabel',
    description: 'label shown instead of users in poll responses if poll is secret',
  },
  activePollInstruction: {
    id: 'app.poll.activePollInstruction',
    description: 'instructions displayed when a poll is active',
  },
  true: {
    id: 'app.poll.t',
    description: 'Poll true option value',
  },
  false: {
    id: 'app.poll.f',
    description: 'Poll false option value',
  },
  yes: {
    id: 'app.poll.y',
    description: 'Poll yes option value',
  },
  no: {
    id: 'app.poll.n',
    description: 'Poll no option value',
  },
  abstention: {
    id: 'app.poll.abstention',
    description: 'Poll Abstention option value',
  },
  showCorrectAnswerLabel: {
    id: 'app.poll.quiz.showCorrectAnswer',
    description: 'Label for checkbox to show correct answer in quiz poll',
  },
  correctAnswerTitle: {
    id: 'app.poll.quiz.liveResult.title.correct',
    description: 'Title for correct answer in quiz poll live result',
  },
  correctOption: {
    id: 'app.poll.quiz.options.correct',
    description: 'Label for correct answer option in quiz poll',
  },
  incorrectOption: {
    id: 'app.poll.quiz.options.incorrect',
    description: 'Label for incorrect answer option in quiz poll',
  },
});

interface LiveResultProps {
  questionText: string;
  responses: Array<ResponseInfo>;
  usersCount: number;
  numberOfAnswerCount: number;
  animations: boolean;
  pollId: string;
  users: Array<UserInfo>;
  isSecret: boolean;
  isQuiz: boolean;
}

const LiveResult: React.FC<LiveResultProps> = ({
  questionText,
  responses,
  usersCount,
  numberOfAnswerCount,
  animations,
  pollId,
  users,
  isSecret,
  isQuiz,
}) => {
  const CHAT_CONFIG = window.meetingClientSettings.public.chat;
  const PUBLIC_CHAT_KEY = CHAT_CONFIG.public_group_id;

  const intl = useIntl();
  const [pollPublishResult] = useMutation(POLL_PUBLISH_RESULT);
  const [stopPoll] = useMutation(POLL_CANCEL);
  const [shouldShowCorrectAnswer, setShouldShowCorrectAnswers] = React.useState(true);

  const layoutContextDispatch = layoutDispatch();
  const publishPoll = useCallback((pId: string, showAnswer: boolean) => {
    pollPublishResult({
      variables: {
        pollId: pId,
        showAnswer,
      },
    });
  }, []);

  const translatedResponses = responses.map((response) => {
    const translationKey = intlMessages[response.optionDesc.toLowerCase() as keyof typeof intlMessages];
    const optionDesc = translationKey ? intl.formatMessage(translationKey) : response.optionDesc;
    return {
      ...response,
      optionDesc,
    };
  });

  return (
    <div>
      <Styled.Instructions>
        {intl.formatMessage(intlMessages.activePollInstruction)}
      </Styled.Instructions>
      <Styled.Stats>
        {questionText ? <Styled.Title data-test="currentPollQuestion">{questionText}</Styled.Title> : null}
        <Styled.Status>
          {usersCount !== numberOfAnswerCount
            ? (
              <span>
                {`${intl.formatMessage(intlMessages.waitingLabel, {
                  current: numberOfAnswerCount,
                  total: usersCount,
                })} `}
              </span>
            )
            : <span>{intl.formatMessage(intlMessages.doneLabel)}</span>}
          {usersCount !== numberOfAnswerCount
            ? <Styled.ConnectingAnimation animations={animations} /> : null}
        </Styled.Status>
        <ResponsiveContainer width="90%" height={translatedResponses.length * 50}>
          <BarChart
            data={translatedResponses}
            layout="vertical"
          >
            <XAxis type="number" allowDecimals={false} />
            <YAxis width={70} type="category" dataKey="optionDesc" tick={<CustomizedAxisTick />} />
            <Bar dataKey="optionResponsesCount" fill="#0C57A7" />
          </BarChart>
        </ResponsiveContainer>
      </Styled.Stats>
      {
        isQuiz && (
          <Styled.ShowCorrectAnswerLabel
            htmlFor="showCorrectAnswerCheckbox"
            data-test="showCorrectAnswerCheckbox"
          >
            <input
              id="showCorrectAnswerCheckbox"
              type="checkbox"
              checked={shouldShowCorrectAnswer}
              onChange={(e) => {
                setShouldShowCorrectAnswers(e.target.checked);
              }}
            />
            {intl.formatMessage(intlMessages.showCorrectAnswerLabel)}
          </Styled.ShowCorrectAnswerLabel>
        )
      }
      {numberOfAnswerCount >= 0
        ? (
          <Styled.ButtonsActions>
            <Styled.PublishButton
              onClick={() => {
                Session.setItem('pollInitiated', false);
                publishPoll(pollId, shouldShowCorrectAnswer);
                stopPoll();
                layoutContextDispatch({
                  type: ACTIONS.SET_SIDEBAR_CONTENT_IS_OPEN,
                  value: true,
                });
                layoutContextDispatch({
                  type: ACTIONS.SET_SIDEBAR_CONTENT_PANEL,
                  value: PANELS.CHAT,
                });
                layoutContextDispatch({
                  type: ACTIONS.SET_ID_CHAT_OPEN,
                  value: PUBLIC_CHAT_KEY,
                });
              }}
              disabled={numberOfAnswerCount <= 0}
              label={intl.formatMessage(intlMessages.publishLabel)}
              data-test="publishPollingLabel"
              color="primary"
            />
            <Styled.CancelButton
              onClick={() => {
                Session.setItem('pollInitiated', false);
                Session.setItem('resetPollPanel', true);
                stopPoll();
              }}
              label={intl.formatMessage(intlMessages.cancelPollLabel)}
              data-test="cancelPollLabel"
            />
          </Styled.ButtonsActions>
        ) : (
          <Styled.LiveResultButton
            onClick={() => {
              stopPoll();
            }}
            label={intl.formatMessage(intlMessages.backLabel)}
            color="primary"
            data-test="restartPoll"
          />
        )}
      <Styled.Separator />
      {
        !isSecret
          ? (
            <Styled.LiveResultTable>
              <tbody>
                <tr>
                  <Styled.THeading>{intl.formatMessage(intlMessages.usersTitle)}</Styled.THeading>
                  <Styled.THeading>{intl.formatMessage(intlMessages.responsesTitle)}</Styled.THeading>
                  {
                    isQuiz ? (
                      <Styled.THeading>{intl.formatMessage(intlMessages.correctAnswerTitle)}</Styled.THeading>
                    ) : null
                  }
                </tr>
                {
                  users.map((user) => (
                    <tr key={user.user.userId}>
                      <Styled.ResultLeft>{user.user.name}</Styled.ResultLeft>
                      <Styled.ResultRight data-test="userVoteLiveResult">
                        {
                          user.optionDescIds.map((optDesc) => {
                            const translationKey = intlMessages[optDesc.toLowerCase() as keyof typeof intlMessages];
                            return translationKey ? intl.formatMessage(translationKey) : optDesc;
                          }).join()
                        }
                      </Styled.ResultRight>
                      {
                        isQuiz ? user.optionDescIds.length > 0 && (
                          <Styled.ResultRight>
                            {user.optionDescIds.filter((opt) => {
                              const response = responses.find((r) => r.optionDesc === opt);
                              return response && response.correctOption;
                            }).length > 0
                              ? (
                                <Tooltip title={intl.formatMessage(intlMessages.correctOption)}>
                                  <span aria-label={intl.formatMessage(intlMessages.correctOption)}>✅</span>
                                </Tooltip>
                              )
                              : (
                                <Tooltip title={intl.formatMessage(intlMessages.incorrectOption)}>
                                  <span aria-label={intl.formatMessage(intlMessages.incorrectOption)}>❌</span>
                                </Tooltip>
                              )}
                          </Styled.ResultRight>
                        ) : null
                      }
                    </tr>
                  ))
                }
              </tbody>
            </Styled.LiveResultTable>
          )
          : (
            <div>
              {intl.formatMessage(intlMessages.secretPollLabel)}
            </div>
          )
      }
    </div>
  );
};

const LiveResultContainer: React.FC = () => {
  const {
    data: currentPollData,
    loading: currentPollLoading,
    error: currentPollDataError,
  } = useDeduplicatedSubscription<getCurrentPollDataResponse>(getCurrentPollData);

  if (currentPollLoading || !currentPollData) {
    return null;
  }

  if (currentPollDataError) {
    connectionStatus.setSubscriptionFailed(true);
    logger.error(
      {
        logCode: 'subscription_Failed',
        extraInfo: {
          error: currentPollDataError,
        },
      },
      'Subscription failed to load',
    );
    return null;
  }

  if (!currentPollData.poll.length) return null;
  const Settings = getSettingsSingletonInstance();
  // @ts-ignore - JS code
  const { animations } = Settings.application;
  const currentPoll = currentPollData.poll[0];
  const isSecret = currentPoll.secret;
  const {
    questionText,
    responses,
    pollId,
    users,
  } = currentPoll;

  const numberOfAnswerCount = currentPoll.responses_aggregate.aggregate.sum.optionResponsesCount;
  const numberOfUsersCount = currentPoll.users_aggregate.aggregate.count;

  return (
    <LiveResult
      questionText={questionText}
      responses={responses}
      isSecret={isSecret}
      usersCount={numberOfUsersCount}
      numberOfAnswerCount={numberOfAnswerCount ?? 0}
      animations={animations}
      pollId={pollId}
      users={users}
      isQuiz={currentPoll.quiz}
    />
  );
};

export default LiveResultContainer;
