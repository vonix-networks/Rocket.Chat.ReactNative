import React, { Component } from 'react';
import { View } from 'react-native';
import ScrollableTabView from 'react-native-scrollable-tab-view';
import { dequal } from 'dequal';
import { connect } from 'react-redux';
import orderBy from 'lodash/orderBy';
import { sanitizedRaw } from '@nozbe/watermelondb/RawRecord';

import TabBar from './TabBar';
import EmojiCategory from './EmojiCategory';
import styles from './styles';
import categories from './categories';
import database from '../../lib/database';
import { emojisByCategory } from '../../emojis';
import protectedFunction from '../../lib/methods/helpers/protectedFunction';
import shortnameToUnicode from '../../utils/shortnameToUnicode';
import log from '../../utils/log';
import { themes } from '../../constants/colors';
import { withTheme } from '../../theme';
import { IEmoji } from '../../definitions/IEmoji';

const scrollProps = {
	keyboardShouldPersistTaps: 'always',
	keyboardDismissMode: 'none'
};

interface IEmojiPickerProps {
	isMessageContainsOnlyEmoji: boolean;
	getCustomEmoji?: Function;
	baseUrl: string;
	customEmojis?: any;
	style: object;
	theme?: string;
	onEmojiSelected?: ((emoji: any) => void) | ((keyboardId: any, params?: any) => void);
	tabEmojiStyle?: object;
}

interface IEmojiPickerState {
	frequentlyUsed: (string | { content?: string; extension?: string; isCustom: boolean })[];
	customEmojis: any;
	show: boolean;
	width: number | null;
}

class EmojiPicker extends Component<IEmojiPickerProps, IEmojiPickerState> {
	constructor(props: IEmojiPickerProps) {
		super(props);
		const customEmojis = Object.keys(props.customEmojis)
			.filter(item => item === props.customEmojis[item].name)
			.map(item => ({
				content: props.customEmojis[item].name,
				extension: props.customEmojis[item].extension,
				isCustom: true
			}));
		this.state = {
			frequentlyUsed: [],
			customEmojis,
			show: false,
			width: null
		};
	}

	async componentDidMount() {
		await this.updateFrequentlyUsed();
		this.setState({ show: true });
	}

	shouldComponentUpdate(nextProps: any, nextState: any) {
		const { frequentlyUsed, show, width } = this.state;
		const { theme } = this.props;
		if (nextProps.theme !== theme) {
			return true;
		}
		if (nextState.show !== show) {
			return true;
		}
		if (nextState.width !== width) {
			return true;
		}
		if (!dequal(nextState.frequentlyUsed, frequentlyUsed)) {
			return true;
		}
		return false;
	}

	onEmojiSelected = (emoji: IEmoji) => {
		try {
			const { onEmojiSelected } = this.props;
			if (emoji.isCustom) {
				this._addFrequentlyUsed({
					content: emoji.content,
					extension: emoji.extension,
					isCustom: true
				});
				onEmojiSelected!(`:${emoji.content}:`);
			} else {
				const content = emoji;
				this._addFrequentlyUsed({ content, isCustom: false });
				const shortname = `:${emoji}:`;
				onEmojiSelected!(shortnameToUnicode(shortname), shortname);
			}
		} catch (e) {
			log(e);
		}
	};

	_addFrequentlyUsed = protectedFunction(async (emoji: IEmoji) => {
		const db = database.active;
		const freqEmojiCollection = db.get('frequently_used_emojis');
		let freqEmojiRecord: any;
		try {
			freqEmojiRecord = await freqEmojiCollection.find(emoji.content);
		} catch (error) {
			// Do nothing
		}

		await db.write(async () => {
			if (freqEmojiRecord) {
				await freqEmojiRecord.update((f: any) => {
					f.count += 1;
				});
			} else {
				await freqEmojiCollection.create((f: any) => {
					f._raw = sanitizedRaw({ id: emoji.content }, freqEmojiCollection.schema);
					Object.assign(f, emoji);
					f.count = 1;
				});
			}
		});
	});

	updateFrequentlyUsed = async () => {
		const db = database.active;
		const frequentlyUsedRecords = await db.get('frequently_used_emojis').query().fetch();
		const frequentlyUsedOrdered = orderBy(frequentlyUsedRecords, ['count'], ['desc']);
		const frequentlyUsed = frequentlyUsedOrdered.map(item => {
			if (item.isCustom) {
				return { content: item.content, extension: item.extension, isCustom: item.isCustom };
			}
			return shortnameToUnicode(`${item.content}`);
		});
		this.setState({ frequentlyUsed });
	};

	onLayout = ({
		nativeEvent: {
			layout: { width }
		}
	}: any) => this.setState({ width });

	renderCategory(category: any, i: number, label: string) {
		const { frequentlyUsed, customEmojis, width } = this.state;
		const { baseUrl } = this.props;

		let emojis = [];
		if (i === 0) {
			emojis = frequentlyUsed;
		} else if (i === 1) {
			emojis = customEmojis;
		} else {
			emojis = emojisByCategory[category];
		}
		return (
			<EmojiCategory
				emojis={emojis}
				onEmojiSelected={(emoji: IEmoji) => this.onEmojiSelected(emoji)}
				style={styles.categoryContainer}
				width={width!}
				baseUrl={baseUrl}
				tabLabel={label}
			/>
		);
	}

	render() {
		const { show, frequentlyUsed } = this.state;
		const { tabEmojiStyle, theme } = this.props;

		if (!show) {
			return null;
		}
		return (
			<View onLayout={this.onLayout} style={{ flex: 1 }}>
				<ScrollableTabView
					renderTabBar={() => <TabBar tabEmojiStyle={tabEmojiStyle} theme={theme} />}
					/* @ts-ignore*/
					contentProps={scrollProps}
					style={{ backgroundColor: themes[theme!].focusedBackground }}>
					{categories.tabs.map((tab, i) =>
						i === 0 && frequentlyUsed.length === 0
							? null // when no frequentlyUsed don't show the tab
							: this.renderCategory(tab.category, i, tab.tabLabel)
					)}
				</ScrollableTabView>
			</View>
		);
	}
}

const mapStateToProps = (state: any) => ({
	customEmojis: state.customEmojis
});

// TODO - remove this as any, at the new PR to fix the HOC erros
export default connect(mapStateToProps)(withTheme(EmojiPicker)) as any;
