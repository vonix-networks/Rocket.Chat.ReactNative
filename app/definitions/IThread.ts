import Model from '@nozbe/watermelondb/Model';
import { MarkdownAST } from '@rocket.chat/message-parser';

import { IAttachment } from './IAttachment';
import { IEditedBy, IUserChannel, IUserMention, IUserMessage, MessageType } from './IMessage';
import { IReaction } from './IReaction';
import { IUrl } from './IUrl';

interface IFileThread {
	_id: string;
	name: string;
	type: string;
}

export interface IThreadResult {
	_id: string;
	rid: string;
	ts: string | Date;
	msg?: string;
	file?: IFileThread;
	files?: IFileThread[];
	groupable?: boolean;
	attachments?: IAttachment[];
	md?: MarkdownAST;
	u: IUserMessage;
	_updatedAt: Date;
	urls?: IUrl[];
	mentions?: IUserMention[];
	channels?: IUserChannel[];
	replies?: string[];
	tcount?: number;
	tlm?: Date;
}

export interface IThread {
	id: string;
	tmsg?: string;
	msg?: string;
	t?: MessageType;
	rid: string;
	_updatedAt?: Date;
	ts?: Date;
	u?: IUserMessage;
	alias?: string;
	parseUrls?: boolean;
	groupable?: boolean;
	avatar?: string;
	emoji?: string;
	attachments?: IAttachment[];
	urls?: IUrl[];
	status?: number;
	pinned?: boolean;
	starred?: boolean;
	editedBy?: IEditedBy;
	reactions?: IReaction[];
	role?: string;
	drid?: string;
	dcount?: number | string;
	dlm?: number;
	tmid?: string;
	tcount?: number | string;
	tlm?: string;
	replies?: string[];
	mentions?: IUserMention[];
	channels?: IUserChannel[];
	unread?: boolean;
	autoTranslate?: boolean;
	translations?: any;
	e2e?: string;
	subscription: { id: string };
}

export type TThreadModel = IThread & Model;
