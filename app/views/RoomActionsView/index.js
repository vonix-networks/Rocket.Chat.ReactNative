import React from 'react';
import PropTypes from 'prop-types';
import { Share, Switch, Text, View } from 'react-native';
import { connect } from 'react-redux';
import isEmpty from 'lodash/isEmpty';
import { Q } from '@nozbe/watermelondb';

import { compareServerVersion } from '../../lib/utils';
import Touch from '../../utils/touch';
import { setLoading } from '../../actions/selectedUsers';
import { closeRoom, leaveRoom } from '../../actions/room';
import sharedStyles from '../Styles';
import Avatar from '../../containers/Avatar';
import Status from '../../containers/Status';
import * as List from '../../containers/List';
import RocketChat from '../../lib/rocketchat';
import log, { events, logEvent } from '../../utils/log';
import RoomTypeIcon from '../../containers/RoomTypeIcon';
import I18n from '../../i18n';
import StatusBar from '../../containers/StatusBar';
import { SWITCH_TRACK_COLOR, themes } from '../../constants/colors';
import { withTheme } from '../../theme';
import * as HeaderButton from '../../containers/HeaderButton';
import { MarkdownPreview } from '../../containers/markdown';
import { showConfirmationAlert, showErrorAlert } from '../../utils/info';
import SafeAreaView from '../../containers/SafeAreaView';
import { E2E_ROOM_TYPES } from '../../lib/encryption/constants';
import protectedFunction from '../../lib/methods/helpers/protectedFunction';
import database from '../../lib/database';
import { withDimensions } from '../../dimensions';
import styles from './styles';

class RoomActionsView extends React.Component {
	static navigationOptions = ({ navigation, isMasterDetail }) => {
		const options = {
			title: I18n.t('Actions')
		};
		if (isMasterDetail) {
			options.headerLeft = () => <HeaderButton.CloseModal navigation={navigation} testID='room-actions-view-close' />;
		}
		return options;
	};

	static propTypes = {
		navigation: PropTypes.object,
		route: PropTypes.object,
		leaveRoom: PropTypes.func,
		jitsiEnabled: PropTypes.bool,
		jitsiEnableTeams: PropTypes.bool,
		jitsiEnableChannels: PropTypes.bool,
		encryptionEnabled: PropTypes.bool,
		setLoadingInvite: PropTypes.func,
		closeRoom: PropTypes.func,
		theme: PropTypes.string,
		fontScale: PropTypes.number,
		serverVersion: PropTypes.string,
		addUserToJoinedRoomPermission: PropTypes.array,
		addUserToAnyCRoomPermission: PropTypes.array,
		addUserToAnyPRoomPermission: PropTypes.array,
		createInviteLinksPermission: PropTypes.array,
		editRoomPermission: PropTypes.array,
		toggleRoomE2EEncryptionPermission: PropTypes.array,
		viewBroadcastMemberListPermission: PropTypes.array,
		transferLivechatGuestPermission: PropTypes.array,
		createTeamPermission: PropTypes.array,
		addTeamChannelPermission: PropTypes.array,
		convertTeamPermission: PropTypes.array,
		viewCannedResponsesPermission: PropTypes.array
	};

	constructor(props) {
		super(props);
		this.mounted = false;
		const room = props.route.params?.room;
		const member = props.route.params?.member;
		this.rid = props.route.params?.rid;
		this.t = props.route.params?.t;
		this.joined = props.route.params?.joined;
		this.state = {
			room: room || { rid: this.rid, t: this.t },
			membersCount: 0,
			member: member || {},
			joined: !!room,
			canViewMembers: false,
			canAutoTranslate: false,
			canAddUser: false,
			canInviteUser: false,
			canForwardGuest: false,
			canReturnQueue: false,
			canEdit: false,
			canToggleEncryption: false,
			canCreateTeam: false,
			canAddChannelToTeam: false,
			canConvertTeam: false,
			canViewCannedResponse: false
		};
		if (room && room.observe && room.rid) {
			this.roomObservable = room.observe();
			this.subscription = this.roomObservable.subscribe(changes => {
				if (this.mounted) {
					this.setState({ room: changes });
				} else {
					this.state.room = changes;
				}
			});
		}
	}

	async componentDidMount() {
		this.mounted = true;
		const { room, member } = this.state;
		if (room.rid) {
			if (!room.id && !this.isOmnichannelPreview) {
				try {
					const result = await RocketChat.getChannelInfo(room.rid);
					if (result.success) {
						this.setState({ room: { ...result.channel, rid: result.channel._id } });
					}
				} catch (e) {
					log(e);
				}
			}

			if (room && room.t !== 'd' && this.canViewMembers()) {
				try {
					const counters = await RocketChat.getRoomCounters(room.rid, room.t);
					if (counters.success) {
						this.setState({ membersCount: counters.members, joined: counters.joined });
					}
				} catch (e) {
					log(e);
				}
			} else if (room.t === 'd' && isEmpty(member)) {
				this.updateRoomMember();
			}

			const canAutoTranslate = await RocketChat.canAutoTranslate();
			const canAddUser = await this.canAddUser();
			const canInviteUser = await this.canInviteUser();
			const canEdit = await this.canEdit();
			const canToggleEncryption = await this.canToggleEncryption();
			const canViewMembers = await this.canViewMembers();
			const canCreateTeam = await this.canCreateTeam();
			const canAddChannelToTeam = await this.canAddChannelToTeam();
			const canConvertTeam = await this.canConvertTeam();

			this.setState({
				canAutoTranslate,
				canAddUser,
				canInviteUser,
				canEdit,
				canToggleEncryption,
				canViewMembers,
				canCreateTeam,
				canAddChannelToTeam,
				canConvertTeam
			});

			// livechat permissions
			if (room.t === 'l') {
				const canForwardGuest = await this.canForwardGuest();
				const canReturnQueue = await this.canReturnQueue();
				const canViewCannedResponse = await this.canViewCannedResponse();
				this.setState({ canForwardGuest, canReturnQueue, canViewCannedResponse });
			}
		}
	}

	componentWillUnmount() {
		if (this.subscription && this.subscription.unsubscribe) {
			this.subscription.unsubscribe();
		}
	}

	get isOmnichannelPreview() {
		const { room } = this.state;
		return room.t === 'l' && room.status === 'queued' && !this.joined;
	}

	onPressTouchable = item => {
		const { route, event, params } = item;
		if (route) {
			logEvent(events[`RA_GO_${route.replace('View', '').toUpperCase()}${params.name ? params.name.toUpperCase() : ''}`]);
			const { navigation } = this.props;
			navigation.navigate(route, params);
		}
		if (event) {
			return event();
		}
	};

	canAddUser = async () => {
		const { room, joined } = this.state;
		const { addUserToJoinedRoomPermission, addUserToAnyCRoomPermission, addUserToAnyPRoomPermission } = this.props;
		const { rid, t } = room;
		let canAddUser = false;

		const userInRoom = joined;
		const permissions = await RocketChat.hasPermission(
			[addUserToJoinedRoomPermission, addUserToAnyCRoomPermission, addUserToAnyPRoomPermission],
			rid
		);

		if (userInRoom && permissions[0]) {
			canAddUser = true;
		}
		if (t === 'c' && permissions[1]) {
			canAddUser = true;
		}
		if (t === 'p' && permissions[2]) {
			canAddUser = true;
		}
		return canAddUser;
	};

	canInviteUser = async () => {
		const { room } = this.state;
		const { createInviteLinksPermission } = this.props;
		const { rid } = room;
		const permissions = await RocketChat.hasPermission([createInviteLinksPermission], rid);

		const canInviteUser = permissions[0];
		return canInviteUser;
	};

	canEdit = async () => {
		const { room } = this.state;
		const { editRoomPermission } = this.props;
		const { rid } = room;
		const permissions = await RocketChat.hasPermission([editRoomPermission], rid);

		const canEdit = permissions[0];
		return canEdit;
	};

	canCreateTeam = async () => {
		const { room } = this.state;
		const { createTeamPermission } = this.props;
		const { rid } = room;
		const permissions = await RocketChat.hasPermission([createTeamPermission], rid);

		const canCreateTeam = permissions[0];
		return canCreateTeam;
	};

	canAddChannelToTeam = async () => {
		const { room } = this.state;
		const { addTeamChannelPermission } = this.props;
		const { rid } = room;
		const permissions = await RocketChat.hasPermission([addTeamChannelPermission], rid);

		const canAddChannelToTeam = permissions[0];
		return canAddChannelToTeam;
	};

	canConvertTeam = async () => {
		const { room } = this.state;
		const { convertTeamPermission } = this.props;
		const { rid } = room;
		const permissions = await RocketChat.hasPermission([convertTeamPermission], rid);

		const canConvertTeam = permissions[0];
		return canConvertTeam;
	};

	canToggleEncryption = async () => {
		const { room } = this.state;
		const { toggleRoomE2EEncryptionPermission } = this.props;
		const { rid } = room;
		const permissions = await RocketChat.hasPermission([toggleRoomE2EEncryptionPermission], rid);

		const canToggleEncryption = permissions[0];
		return canToggleEncryption;
	};

	canViewMembers = async () => {
		const { room } = this.state;
		const { viewBroadcastMemberListPermission } = this.props;
		const { rid, t, broadcast } = room;
		if (broadcast) {
			const permissions = await RocketChat.hasPermission([viewBroadcastMemberListPermission], rid);
			if (!permissions[0]) {
				return false;
			}
		}

		// This method is executed only in componentDidMount and returns a value
		// We save the state to read in render
		const result = t === 'c' || t === 'p';
		return result;
	};

	canForwardGuest = async () => {
		const { room } = this.state;
		const { transferLivechatGuestPermission } = this.props;
		const { rid } = room;
		const permissions = await RocketChat.hasPermission([transferLivechatGuestPermission], rid);
		return permissions[0];
	};

	canViewCannedResponse = async () => {
		const { room } = this.state;
		const { viewCannedResponsesPermission } = this.props;
		const { rid } = room;
		const permissions = await RocketChat.hasPermission([viewCannedResponsesPermission], rid);
		return permissions[0];
	};

	canReturnQueue = async () => {
		try {
			const { returnQueue } = await RocketChat.getRoutingConfig();
			return returnQueue;
		} catch {
			// do nothing
		}
	};

	renderEncryptedSwitch = () => {
		const { room, canToggleEncryption, canEdit } = this.state;
		const { encrypted } = room;
		const { serverVersion } = this.props;
		let hasPermission = false;
		if (compareServerVersion(serverVersion, 'lowerThan', '3.11.0')) {
			hasPermission = canEdit;
		} else {
			hasPermission = canToggleEncryption;
		}
		return (
			<Switch value={encrypted} trackColor={SWITCH_TRACK_COLOR} onValueChange={this.toggleEncrypted} disabled={!hasPermission} />
		);
	};

	closeLivechat = () => {
		const {
			room: { rid }
		} = this.state;
		const { dispatch } = this.props;

		dispatch(closeRoom(rid));
	};

	returnLivechat = () => {
		const {
			room: { rid }
		} = this.state;
		showConfirmationAlert({
			message: I18n.t('Would_you_like_to_return_the_inquiry'),
			confirmationText: I18n.t('Yes'),
			onPress: async () => {
				try {
					await RocketChat.returnLivechat(rid);
				} catch (e) {
					showErrorAlert(e.reason, I18n.t('Oops'));
				}
			}
		});
	};

	updateRoomMember = async () => {
		const { room } = this.state;

		try {
			if (!RocketChat.isGroupChat(room)) {
				const roomUserId = RocketChat.getUidDirectMessage(room);
				const result = await RocketChat.getUserInfo(roomUserId);
				if (result.success) {
					this.setState({ member: result.user });
				}
			}
		} catch (e) {
			log(e);
			this.setState({ member: {} });
		}
	};

	addUser = async () => {
		const { room } = this.state;
		const { dispatch, navigation } = this.props;
		const { rid } = room;
		try {
			dispatch(setLoading(true));
			await RocketChat.addUsersToRoom(rid);
			navigation.pop();
		} catch (e) {
			log(e);
		} finally {
			dispatch(setLoading(false));
		}
	};

	toggleBlockUser = async () => {
		logEvent(events.RA_TOGGLE_BLOCK_USER);
		const { room } = this.state;
		const { rid, blocker } = room;
		const { member } = this.state;
		try {
			await RocketChat.toggleBlockUser(rid, member._id, !blocker);
		} catch (e) {
			logEvent(events.RA_TOGGLE_BLOCK_USER_F);
			log(e);
		}
	};

	toggleEncrypted = async () => {
		logEvent(events.RA_TOGGLE_ENCRYPTED);
		const { room } = this.state;
		const { rid } = room;
		const db = database.active;

		// Toggle encrypted value
		const encrypted = !room.encrypted;
		try {
			// Instantly feedback to the user
			await db.action(async () => {
				await room.update(
					protectedFunction(r => {
						r.encrypted = encrypted;
					})
				);
			});

			try {
				// Send new room setting value to server
				const { result } = await RocketChat.saveRoomSettings(rid, { encrypted });
				// If it was saved successfully
				if (result) {
					return;
				}
			} catch {
				// do nothing
			}

			// If something goes wrong we go back to the previous value
			await db.action(async () => {
				await room.update(
					protectedFunction(r => {
						r.encrypted = room.encrypted;
					})
				);
			});
		} catch (e) {
			logEvent(events.RA_TOGGLE_ENCRYPTED_F);
			log(e);
		}
	};

	handleShare = () => {
		logEvent(events.RA_SHARE);
		const { room } = this.state;
		const permalink = RocketChat.getPermalinkChannel(room);
		if (!permalink) {
			return;
		}
		Share.share({
			message: permalink
		});
	};

	leaveChannel = () => {
		const { room } = this.state;
		const { dispatch } = this.props;

		showConfirmationAlert({
			message: I18n.t('Are_you_sure_you_want_to_leave_the_room', { room: RocketChat.getRoomTitle(room) }),
			confirmationText: I18n.t('Yes_action_it', { action: I18n.t('leave') }),
			onPress: () => dispatch(leaveRoom('channel', room))
		});
	};

	convertTeamToChannel = async () => {
		const { room } = this.state;
		const { navigation } = this.props;

		try {
			const result = await RocketChat.teamListRoomsOfUser({ teamId: room.teamId, userId: room.u._id });

			if (result.rooms?.length) {
				const teamChannels = result.rooms.map(r => ({
					rid: r._id,
					name: r.name,
					teamId: r.teamId
				}));
				navigation.navigate('SelectListView', {
					title: 'Converting_Team_To_Channel',
					data: teamChannels,
					infoText: 'Select_Team_Channels_To_Delete',
					nextAction: data => this.convertTeamToChannelConfirmation(data)
				});
			} else {
				this.convertTeamToChannelConfirmation();
			}
		} catch (e) {
			this.convertTeamToChannelConfirmation();
		}
	};

	handleConvertTeamToChannel = async selected => {
		logEvent(events.RA_CONVERT_TEAM_TO_CHANNEL);
		try {
			const { room } = this.state;
			const { navigation } = this.props;

			const result = await RocketChat.convertTeamToChannel({ teamId: room.teamId, selected });

			if (result.success) {
				navigation.navigate('RoomView');
			}
		} catch (e) {
			logEvent(events.RA_CONVERT_TEAM_TO_CHANNEL_F);
			log(e);
		}
	};

	convertTeamToChannelConfirmation = (selected = []) => {
		showConfirmationAlert({
			title: I18n.t('Confirmation'),
			message: I18n.t('You_are_converting_the_team'),
			confirmationText: I18n.t('Convert'),
			onPress: () => this.handleConvertTeamToChannel(selected)
		});
	};

	leaveTeam = async () => {
		const { room } = this.state;
		const { navigation, dispatch } = this.props;

		try {
			const result = await RocketChat.teamListRoomsOfUser({ teamId: room.teamId, userId: room.u._id });

			if (result.rooms?.length) {
				const teamChannels = result.rooms.map(r => ({
					rid: r._id,
					name: r.name,
					teamId: r.teamId,
					alert: r.isLastOwner
				}));
				navigation.navigate('SelectListView', {
					title: 'Leave_Team',
					data: teamChannels,
					infoText: 'Select_Team_Channels',
					nextAction: data => dispatch(leaveRoom('team', room, data)),
					showAlert: () => showErrorAlert(I18n.t('Last_owner_team_room'), I18n.t('Cannot_leave'))
				});
			} else {
				showConfirmationAlert({
					message: I18n.t('You_are_leaving_the_team', { team: RocketChat.getRoomTitle(room) }),
					confirmationText: I18n.t('Yes_action_it', { action: I18n.t('leave') }),
					onPress: () => dispatch(leaveRoom('team', room))
				});
			}
		} catch (e) {
			showConfirmationAlert({
				message: I18n.t('You_are_leaving_the_team', { team: RocketChat.getRoomTitle(room) }),
				confirmationText: I18n.t('Yes_action_it', { action: I18n.t('leave') }),
				onPress: () => dispatch(leaveRoom('team', room))
			});
		}
	};

	handleConvertToTeam = async () => {
		logEvent(events.RA_CONVERT_TO_TEAM);
		try {
			const { room } = this.state;
			const { navigation } = this.props;
			const result = await RocketChat.convertChannelToTeam({ rid: room.rid, name: room.name, type: room.t });

			if (result.success) {
				navigation.navigate('RoomView');
			}
		} catch (e) {
			logEvent(events.RA_CONVERT_TO_TEAM_F);
			log(e);
		}
	};

	convertToTeam = () => {
		showConfirmationAlert({
			title: I18n.t('Confirmation'),
			message: I18n.t('Convert_to_Team_Warning'),
			confirmationText: I18n.t('Convert'),
			onPress: () => this.handleConvertToTeam()
		});
	};

	handleMoveToTeam = async selected => {
		logEvent(events.RA_MOVE_TO_TEAM);
		try {
			const { room } = this.state;
			const { navigation } = this.props;
			const result = await RocketChat.addRoomsToTeam({ teamId: selected?.[0], rooms: [room.rid] });
			if (result.success) {
				navigation.navigate('RoomView');
			}
		} catch (e) {
			logEvent(events.RA_MOVE_TO_TEAM_F);
			log(e);
			showErrorAlert(I18n.t('There_was_an_error_while_action', { action: I18n.t('moving_channel_to_team') }));
		}
	};

	moveToTeam = async () => {
		try {
			const { navigation } = this.props;
			const db = database.active;
			const subCollection = db.get('subscriptions');
			const teamRooms = await subCollection.query(Q.where('team_main', true));

			if (teamRooms.length) {
				const data = teamRooms.map(team => ({
					rid: team.teamId,
					t: team.t,
					name: team.name
				}));
				navigation.navigate('SelectListView', {
					title: 'Move_to_Team',
					infoText: 'Move_Channel_Paragraph',
					nextAction: () => {
						navigation.push('SelectListView', {
							title: 'Select_Team',
							data,
							isRadio: true,
							isSearch: true,
							onSearch: onChangeText => this.searchTeam(onChangeText),
							nextAction: selected =>
								showConfirmationAlert({
									title: I18n.t('Confirmation'),
									message: I18n.t('Move_to_Team_Warning'),
									confirmationText: I18n.t('Yes_action_it', { action: I18n.t('move') }),
									onPress: () => this.handleMoveToTeam(selected)
								})
						});
					}
				});
			}
		} catch (e) {
			log(e);
		}
	};

	searchTeam = async onChangeText => {
		logEvent(events.RA_SEARCH_TEAM);
		try {
			const { addTeamChannelPermission, createTeamPermission } = this.props;
			const QUERY_SIZE = 50;
			const db = database.active;
			const teams = await db
				.get('subscriptions')
				.query(
					Q.where('team_main', true),
					Q.where('name', Q.like(`%${onChangeText}%`)),
					Q.experimentalTake(QUERY_SIZE),
					Q.experimentalSortBy('room_updated_at', Q.desc)
				);

			const asyncFilter = async teamArray => {
				const results = await Promise.all(
					teamArray.map(async team => {
						const permissions = await RocketChat.hasPermission([addTeamChannelPermission, createTeamPermission], team.rid);
						if (!permissions[0]) {
							return false;
						}
						return true;
					})
				);

				return teamArray.filter((_v, index) => results[index]);
			};
			const teamsFiltered = await asyncFilter(teams);
			return teamsFiltered;
		} catch (e) {
			log(e);
		}
	};

	renderRoomInfo = () => {
		const { room, member } = this.state;
		const { rid, name, t, topic } = room;
		const { theme, fontScale } = this.props;

		const avatar = RocketChat.getRoomAvatar(room);
		const isGroupChat = RocketChat.isGroupChat(room);

		return (
			<List.Section>
				<List.Separator />
				<Touch
					onPress={() =>
						this.onPressTouchable({
							route: 'RoomInfoView',
							// forward room only if room isn't joined
							params: {
								rid,
								t,
								room,
								member
							}
						})
					}
					style={{ backgroundColor: themes[theme].backgroundColor }}
					accessibilityLabel={I18n.t('Room_Info')}
					accessibilityTraits='button'
					enabled={!isGroupChat}
					testID='room-actions-info'
					theme={theme}>
					<View style={[styles.roomInfoContainer, { height: 72 * fontScale }]}>
						<Avatar text={avatar} style={styles.avatar} size={50 * fontScale} type={t} rid={rid}>
							{t === 'd' && member._id ? (
								<View style={[sharedStyles.status, { backgroundColor: themes[theme].backgroundColor }]}>
									<Status size={16} id={member._id} />
								</View>
							) : null}
						</Avatar>
						<View style={styles.roomTitleContainer}>
							{room.t === 'd' ? (
								<Text style={[styles.roomTitle, { color: themes[theme].titleText }]} numberOfLines={1}>
									{room.fname}
								</Text>
							) : (
								<View style={styles.roomTitleRow}>
									<RoomTypeIcon type={room.prid ? 'discussion' : room.t} teamMain={room.teamMain} status={room.visitor?.status} />
									<Text style={[styles.roomTitle, { color: themes[theme].titleText }]} numberOfLines={1}>
										{RocketChat.getRoomTitle(room)}
									</Text>
								</View>
							)}
							<MarkdownPreview
								msg={t === 'd' ? `@${name}` : topic}
								style={[styles.roomDescription, { color: themes[theme].auxiliaryText }]}
							/>
							{room.t === 'd' && (
								<MarkdownPreview
									msg={member.statusText}
									style={[styles.roomDescription, { color: themes[theme].auxiliaryText }]}
								/>
							)}
						</View>
						{isGroupChat ? null : <List.Icon name='chevron-right' style={styles.actionIndicator} />}
					</View>
				</Touch>
				<List.Separator />
			</List.Section>
		);
	};

	renderJitsi = () => {
		const { room } = this.state;
		const { jitsiEnabled, jitsiEnableTeams, jitsiEnableChannels } = this.props;

		const isJitsiDisabledForTeams = room.teamMain && !jitsiEnableTeams;
		const isJitsiDisabledForChannels = !room.teamMain && (room.t === 'p' || room.t === 'c') && !jitsiEnableChannels;

		if (!jitsiEnabled || isJitsiDisabledForTeams || isJitsiDisabledForChannels) {
			return null;
		}

		return (
			<List.Section>
				<List.Separator />
				<List.Item
					title='Voice_call'
					onPress={() => RocketChat.callJitsi(room, true)}
					testID='room-actions-voice'
					left={() => <List.Icon name='phone' />}
					showActionIndicator
				/>
				<List.Separator />
				<List.Item
					title='Video_call'
					onPress={() => RocketChat.callJitsi(room)}
					testID='room-actions-video'
					left={() => <List.Icon name='camera' />}
					showActionIndicator
				/>
				<List.Separator />
			</List.Section>
		);
	};

	renderE2EEncryption = () => {
		const { room } = this.state;
		const { encryptionEnabled } = this.props;

		// If this room type can be encrypted
		// If e2e is enabled
		if (E2E_ROOM_TYPES[room?.t] && encryptionEnabled) {
			return (
				<List.Section>
					<List.Separator />
					<List.Item
						title='Encrypted'
						testID='room-actions-encrypt'
						left={() => <List.Icon name='encrypted' />}
						right={this.renderEncryptedSwitch}
					/>
					<List.Separator />
				</List.Section>
			);
		}
		return null;
	};

	renderLastSection = () => {
		const { room, joined } = this.state;
		const { theme } = this.props;
		const { t, blocker } = room;

		if (!joined || t === 'l') {
			return null;
		}

		if (t === 'd' && !RocketChat.isGroupChat(room)) {
			return (
				<List.Section>
					<List.Separator />
					<List.Item
						title={`${blocker ? 'Unblock' : 'Block'}_user`}
						onPress={() =>
							this.onPressTouchable({
								event: this.toggleBlockUser
							})
						}
						testID='room-actions-block-user'
						left={() => <List.Icon name='ignore' color={themes[theme].dangerColor} />}
						showActionIndicator
						color={themes[theme].dangerColor}
					/>
					<List.Separator />
				</List.Section>
			);
		}

		if (t === 'p' || t === 'c') {
			return (
				<List.Section>
					<List.Separator />
					<List.Item
						title='Leave'
						onPress={() =>
							this.onPressTouchable({
								event: room.teamMain ? this.leaveTeam : this.leaveChannel
							})
						}
						testID='room-actions-leave-channel'
						left={() => <List.Icon name='logout' color={themes[theme].dangerColor} />}
						showActionIndicator
						color={themes[theme].dangerColor}
					/>
					<List.Separator />
				</List.Section>
			);
		}

		return null;
	};

	teamChannelActions = (t, room) => {
		const { canEdit, canCreateTeam, canAddChannelToTeam } = this.state;
		const canConvertToTeam = canEdit && canCreateTeam && !room.teamMain;
		const canMoveToTeam = canEdit && canAddChannelToTeam && !room.teamId;

		return (
			<>
				{['c', 'p'].includes(t) && canConvertToTeam ? (
					<>
						<List.Item
							title='Convert_to_Team'
							onPress={() =>
								this.onPressTouchable({
									event: this.convertToTeam
								})
							}
							testID='room-actions-convert-to-team'
							left={() => <List.Icon name='teams' />}
							showActionIndicator
						/>
						<List.Separator />
					</>
				) : null}

				{['c', 'p'].includes(t) && canMoveToTeam ? (
					<>
						<List.Item
							title='Move_to_Team'
							onPress={() =>
								this.onPressTouchable({
									event: this.moveToTeam
								})
							}
							testID='room-actions-move-to-team'
							left={() => <List.Icon name='channel-move-to-team' />}
							showActionIndicator
						/>
						<List.Separator />
					</>
				) : null}
			</>
		);
	};

	teamToChannelActions = (t, room) => {
		const { canEdit, canConvertTeam } = this.state;
		const canConvertTeamToChannel = canEdit && canConvertTeam && !!room?.teamMain;

		return (
			<>
				{['c', 'p'].includes(t) && canConvertTeamToChannel ? (
					<>
						<List.Item
							title='Convert_to_Channel'
							onPress={() =>
								this.onPressTouchable({
									event: this.convertTeamToChannel
								})
							}
							left={() => <List.Icon name='channel-public' />}
							showActionIndicator
						/>
						<List.Separator />
					</>
				) : null}
			</>
		);
	};

	render() {
		const {
			room,
			membersCount,
			canViewMembers,
			canAddUser,
			canInviteUser,
			joined,
			canAutoTranslate,
			canForwardGuest,
			canReturnQueue,
			canViewCannedResponse
		} = this.state;
		const { rid, t, prid } = room;
		const isGroupChat = RocketChat.isGroupChat(room);

		return (
			<SafeAreaView testID='room-actions-view'>
				<StatusBar />
				<List.Container testID='room-actions-scrollview'>
					{this.renderRoomInfo()}
					{this.renderJitsi()}
					{this.renderE2EEncryption()}
					<List.Section>
						<List.Separator />

						{(['c', 'p'].includes(t) && canViewMembers) || isGroupChat ? (
							<>
								<List.Item
									title='Members'
									subtitle={membersCount > 0 ? `${membersCount} ${I18n.t('members')}` : null}
									onPress={() => this.onPressTouchable({ route: 'RoomMembersView', params: { rid, room } })}
									testID='room-actions-members'
									left={() => <List.Icon name='team' />}
									showActionIndicator
									translateSubtitle={false}
								/>
								<List.Separator />
							</>
						) : null}

						{['c', 'p'].includes(t) && canAddUser ? (
							<>
								<List.Item
									title='Add_users'
									onPress={() =>
										this.onPressTouchable({
											route: 'SelectedUsersView',
											params: {
												rid,
												title: I18n.t('Add_users'),
												nextAction: this.addUser
											}
										})
									}
									testID='room-actions-add-user'
									left={() => <List.Icon name='add' />}
									showActionIndicator
								/>
								<List.Separator />
							</>
						) : null}

						{['c', 'p'].includes(t) && canInviteUser ? (
							<>
								<List.Item
									title='Invite_users'
									onPress={() =>
										this.onPressTouchable({
											route: 'InviteUsersView',
											params: { rid }
										})
									}
									testID='room-actions-invite-user'
									left={() => <List.Icon name='user-add' />}
									showActionIndicator
								/>
								<List.Separator />
							</>
						) : null}

						{['c', 'p', 'd'].includes(t) && !prid ? (
							<>
								<List.Item
									title='Discussions'
									onPress={() =>
										this.onPressTouchable({
											route: 'DiscussionsView',
											params: {
												rid,
												t
											}
										})
									}
									testID='room-actions-discussions'
									left={() => <List.Icon name='discussions' />}
									showActionIndicator
								/>
								<List.Separator />
							</>
						) : null}

						{['c', 'p', 'd'].includes(t) ? (
							<>
								<List.Item
									title='Files'
									onPress={() =>
										this.onPressTouchable({
											route: 'MessagesView',
											params: { rid, t, name: 'Files' }
										})
									}
									testID='room-actions-files'
									left={() => <List.Icon name='attach' />}
									showActionIndicator
								/>
								<List.Separator />
							</>
						) : null}

						{['c', 'p', 'd'].includes(t) ? (
							<>
								<List.Item
									title='Mentions'
									onPress={() =>
										this.onPressTouchable({
											route: 'MessagesView',
											params: { rid, t, name: 'Mentions' }
										})
									}
									testID='room-actions-mentioned'
									left={() => <List.Icon name='mention' />}
									showActionIndicator
								/>
								<List.Separator />
							</>
						) : null}

						{['c', 'p', 'd'].includes(t) ? (
							<>
								<List.Item
									title='Starred'
									onPress={() =>
										this.onPressTouchable({
											route: 'MessagesView',
											params: { rid, t, name: 'Starred' }
										})
									}
									testID='room-actions-starred'
									left={() => <List.Icon name='star' />}
									showActionIndicator
								/>
								<List.Separator />
							</>
						) : null}

						{['c', 'p', 'd'].includes(t) ? (
							<>
								<List.Item
									title='Share'
									onPress={() =>
										this.onPressTouchable({
											event: this.handleShare
										})
									}
									testID='room-actions-share'
									left={() => <List.Icon name='share' />}
									showActionIndicator
								/>
								<List.Separator />
							</>
						) : null}

						{['c', 'p', 'd'].includes(t) ? (
							<>
								<List.Item
									title='Pinned'
									onPress={() =>
										this.onPressTouchable({
											route: 'MessagesView',
											params: { rid, t, name: 'Pinned' }
										})
									}
									testID='room-actions-pinned'
									left={() => <List.Icon name='pin' />}
									showActionIndicator
								/>
								<List.Separator />
							</>
						) : null}

						{['c', 'p', 'd'].includes(t) && canAutoTranslate ? (
							<>
								<List.Item
									title='Auto_Translate'
									onPress={() =>
										this.onPressTouchable({
											route: 'AutoTranslateView',
											params: { rid, room }
										})
									}
									testID='room-actions-auto-translate'
									left={() => <List.Icon name='language' />}
									showActionIndicator
								/>
								<List.Separator />
							</>
						) : null}

						{['c', 'p', 'd'].includes(t) && joined ? (
							<>
								<List.Item
									title='Notifications'
									onPress={() =>
										this.onPressTouchable({
											route: 'NotificationPrefView',
											params: { rid, room }
										})
									}
									testID='room-actions-notifications'
									left={() => <List.Icon name='notification' />}
									showActionIndicator
								/>
								<List.Separator />
							</>
						) : null}

						{this.teamChannelActions(t, room)}
						{this.teamToChannelActions(t, room)}

						{['l'].includes(t) && !this.isOmnichannelPreview && canViewCannedResponse ? (
							<>
								<List.Item
									title='Canned_Responses'
									onPress={() => this.onPressTouchable({ route: 'CannedResponsesListView', params: { rid, room } })}
									left={() => <List.Icon name='canned-response' />}
									showActionIndicator
								/>
								<List.Separator />
							</>
						) : null}

						{['l'].includes(t) && !this.isOmnichannelPreview ? (
							<>
								<List.Item
									title='Close'
									onPress={() =>
										this.onPressTouchable({
											event: this.closeLivechat
										})
									}
									left={() => <List.Icon name='close' />}
									showActionIndicator
								/>
								<List.Separator />
							</>
						) : null}

						{['l'].includes(t) && !this.isOmnichannelPreview && canForwardGuest ? (
							<>
								<List.Item
									title='Forward'
									onPress={() =>
										this.onPressTouchable({
											route: 'ForwardLivechatView',
											params: { rid }
										})
									}
									left={() => <List.Icon name='user-forward' />}
									showActionIndicator
								/>
								<List.Separator />
							</>
						) : null}

						{['l'].includes(t) && !this.isOmnichannelPreview && canReturnQueue ? (
							<>
								<List.Item
									title='Return'
									onPress={() =>
										this.onPressTouchable({
											event: this.returnLivechat
										})
									}
									left={() => <List.Icon name='undo' />}
									showActionIndicator
								/>
								<List.Separator />
							</>
						) : null}
					</List.Section>

					{this.renderLastSection()}
				</List.Container>
			</SafeAreaView>
		);
	}
}

const mapStateToProps = state => ({
	jitsiEnabled: state.settings.Jitsi_Enabled || false,
	jitsiEnableTeams: state.settings.Jitsi_Enable_Teams || false,
	jitsiEnableChannels: state.settings.Jitsi_Enable_Channels || false,
	encryptionEnabled: state.encryption.enabled,
	serverVersion: state.server.version,
	isMasterDetail: state.app.isMasterDetail,
	addUserToJoinedRoomPermission: state.permissions['add-user-to-joined-room'],
	addUserToAnyCRoomPermission: state.permissions['add-user-to-any-c-room'],
	addUserToAnyPRoomPermission: state.permissions['add-user-to-any-p-room'],
	createInviteLinksPermission: state.permissions['create-invite-links'],
	editRoomPermission: state.permissions['edit-room'],
	toggleRoomE2EEncryptionPermission: state.permissions['toggle-room-e2e-encryption'],
	viewBroadcastMemberListPermission: state.permissions['view-broadcast-member-list'],
	transferLivechatGuestPermission: state.permissions['transfer-livechat-guest'],
	createTeamPermission: state.permissions['create-team'],
	addTeamChannelPermission: state.permissions['add-team-channel'],
	convertTeamPermission: state.permissions['convert-team'],
	viewCannedResponsesPermission: state.permissions['view-canned-responses']
});

export default connect(mapStateToProps)(withTheme(withDimensions(RoomActionsView)));
