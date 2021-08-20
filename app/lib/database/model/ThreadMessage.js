import { Model } from '@nozbe/watermelondb';
import {
	date, field, json, relation
} from '@nozbe/watermelondb/decorators';

import { sanitizer } from '../utils';

export const TABLE_NAME = 'thread_messages';

export default class ThreadMessage extends Model {
	static table = TABLE_NAME;

	static associations = {
		subscriptions: { type: 'belongs_to', key: 'subscription_id' }
	}

	@field('msg') msg;

	@field('t') t;

	@date('ts') ts;

	@json('u', sanitizer) u;

	@relation('subscriptions', 'subscription_id') subscription;

	@field('rid') rid;

	@field('alias') alias;

	@json('parse_urls', sanitizer) parseUrls;

	@field('groupable') groupable;

	@field('avatar') avatar;

	@field('emoji') emoji;

	@json('attachments', sanitizer) attachments;

	@json('urls', sanitizer) urls;

	@date('_updated_at') _updatedAt;

	@field('status') status;

	@field('pinned') pinned;

	@field('starred') starred;

	@json('edited_by', sanitizer) editedBy;

	@json('reactions', sanitizer) reactions;

	@field('role') role;

	@field('drid') drid;

	@field('dcount') dcount;

	@date('dlm') dlm;

	@field('tcount') tcount;

	@date('tlm') tlm;

	@json('replies', sanitizer) replies;

	@json('mentions', sanitizer) mentions;

	@json('channels', sanitizer) channels;

	@field('unread') unread;

	@field('auto_translate') autoTranslate;

	@json('translations', sanitizer) translations;

	@field('draft_message') draftMessage;

	@field('e2e') e2e;
}
