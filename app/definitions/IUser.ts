import Model from '@nozbe/watermelondb/Model';

import { UserStatus } from './UserStatus';
import { IRocketChatRecord } from './IRocketChatRecord';
import { ILoggedUser } from './ILoggedUser';

export interface ILoginToken {
	hashedToken: string;
	twoFactorAuthorizedUntil?: Date;
	twoFactorAuthorizedHash?: string;
}

export interface IMeteorLoginToken extends ILoginToken {
	when: Date;
}

export interface IPersonalAccessToken extends ILoginToken {
	type: 'personalAccessToken';
	createdAt: Date;
	lastTokenPart: string;
	name?: string;
	bypassTwoFactor?: boolean;
}

export interface IUserEmailVerificationToken {
	token: string;
	address: string;
	when: Date;
}

export interface IUserEmailCode {
	code: string;
	expire: Date;
}

type LoginToken = IMeteorLoginToken & IPersonalAccessToken;
export type Username = string;

export type ILoginUsername =
	| {
			username: string;
	  }
	| {
			email: string;
	  };
export type LoginUsername = string | ILoginUsername;

export interface IUserServices {
	password?: {
		bcrypt: string;
	};
	passwordHistory?: string[];
	email?: {
		verificationTokens?: IUserEmailVerificationToken[];
	};
	resume?: {
		loginTokens?: LoginToken[];
	};
	google?: any;
	facebook?: any;
	github?: any;
	totp?: {
		enabled: boolean;
		hashedBackup: string[];
		secret: string;
	};
	email2fa?: {
		enabled: boolean;
		changedAt: Date;
	};
	emailCode: IUserEmailCode[];
	saml?: {
		inResponseTo?: string;
		provider?: string;
		idp?: string;
		idpSession?: string;
		nameID?: string;
	};
	ldap?: {
		id: string;
		idAttribute?: string;
	};
}

export interface IUserEmail {
	address: string;
	verified: boolean;
}

export interface IUserSettings {
	profile: any;
	preferences: {
		[key: string]: any;
	};
}

export interface IUser extends IRocketChatRecord, Omit<ILoggedUser, 'username' | 'name' | 'status'> {
	_id: string;
	id: string;
	token: string;
	createdAt: Date;
	roles: string[];
	type: string;
	active: boolean;
	name?: string;
	username: string;
	services?: IUserServices;
	emails?: IUserEmail[];
	status?: UserStatus;
	statusConnection?: string;
	lastLogin?: Date;
	avatarOrigin?: string;
	avatarETag?: string;
	utcOffset?: number;
	language?: string;
	statusDefault?: UserStatus;
	statusText?: string;
	oauth?: {
		authorizedClients: string[];
	};
	_updatedAt: Date;
	statusLivechat?: string;
	e2e?: {
		private_key: string;
		public_key: string;
	};
	requirePasswordChange?: boolean;
	customFields?: {
		[key: string]: any;
	};
	settings?: IUserSettings;
	defaultRoom?: string;
	ldap?: boolean;
}

export interface IRegisterUser extends IUser {
	username: string;
	name: string;
}
export const isRegisterUser = (user: IUser): user is IRegisterUser => user.username !== undefined && user.name !== undefined;

export type IUserDataEvent = {
	id: unknown;
} & (
	| ({
			type: 'inserted';
	  } & IUser)
	| {
			type: 'removed';
	  }
	| {
			type: 'updated';
			diff: Partial<IUser>;
			unset: Record<keyof IUser, boolean | 0 | 1>;
	  }
);

export type TUserModel = IUser & Model;
