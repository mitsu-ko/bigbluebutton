package org.bigbluebutton.core.apps.polls

import org.bigbluebutton.common2.domain.SimplePollOutVO
import org.bigbluebutton.common2.msgs._
import org.bigbluebutton.core.bus.MessageBus
import org.bigbluebutton.core.domain.MeetingState2x
import org.bigbluebutton.core.models.Polls
import org.bigbluebutton.core.running.LiveMeeting
import org.bigbluebutton.core.apps.{ PermissionCheck, RightsManagementTrait }

trait StartPollReqMsgHdlr extends RightsManagementTrait {
  this: PollApp2x =>

  def handle(msg: StartPollReqMsg, state: MeetingState2x, liveMeeting: LiveMeeting, bus: MessageBus): Unit = {

    def broadcastEvent(msg: StartPollReqMsg, poll: SimplePollOutVO): Unit = {
      val routing = Routing.addMsgToClientRouting(MessageTypes.BROADCAST_TO_MEETING, liveMeeting.props.meetingProp.intId, msg.header.userId)
      val envelope = BbbCoreEnvelope(PollStartedEvtMsg.NAME, routing)
      val header = BbbClientMsgHeader(PollStartedEvtMsg.NAME, liveMeeting.props.meetingProp.intId, msg.header.userId)

      val body = PollStartedEvtMsgBody(msg.header.userId, poll.id, msg.body.pollType, msg.body.secretPoll, msg.body.question, poll)
      val event = PollStartedEvtMsg(header, body)
      val msgEvent = BbbCommonEnvCoreMsg(envelope, event)
      bus.outGW.send(msgEvent)
    }

    if (liveMeeting.props.meetingProp.disabledFeatures.contains("polls")) {
      val meetingId = liveMeeting.props.meetingProp.intId
      val reason = "Polling is disabled for this meeting."
      PermissionCheck.ejectUserForFailedPermission(meetingId, msg.header.userId, reason, bus.outGW, liveMeeting)
    } else if (msg.body.quiz && liveMeeting.props.meetingProp.disabledFeatures.contains("quizzes")) {
      val meetingId = liveMeeting.props.meetingProp.intId
      val reason = "Quiz is disabled for this meeting."
      PermissionCheck.ejectUserForFailedPermission(meetingId, msg.header.userId, reason, bus.outGW, liveMeeting)
    } else if (permissionFailed(PermissionCheck.GUEST_LEVEL, PermissionCheck.PRESENTER_LEVEL, liveMeeting.users2x, msg.header.userId)) {
      val meetingId = liveMeeting.props.meetingProp.intId
      val reason = "No permission to start poll."
      PermissionCheck.ejectUserForFailedPermission(meetingId, msg.header.userId, reason, bus.outGW, liveMeeting)
    } else {
      for {
        pvo <- Polls.handleStartPollReqMsg(state, msg.header.userId, msg, liveMeeting)
      } yield {
        broadcastEvent(msg, pvo)
      }
    }
  }
}
