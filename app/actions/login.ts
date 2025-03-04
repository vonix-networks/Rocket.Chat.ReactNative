import { Action } from 'redux';

import { IUser } from '../definitions';
import * as types from './actionsTypes';

interface ICredentials {
	resume: string;
	user: string;
	password: string;
}

interface ILoginRequest extends Action {
	credentials: any;
	logoutOnError?: boolean;
	isFromWebView?: boolean;
}

interface ILoginSuccess extends Action {
	user: Partial<IUser>;
}

interface ILoginFailure extends Action {
	err: Partial<IUser>;
}

interface ILogout extends Action {
	forcedByServer: boolean;
}

interface ISetUser extends Action {
	user: Partial<IUser>;
}

interface ISetServices extends Action {
	data: Record<string, string>;
}

interface ISetPreference extends Action {
	preference: Record<string, any>;
}

interface ISetLocalAuthenticated extends Action {
	isLocalAuthenticated: boolean;
}

export type TActionsLogin = ILoginRequest &
	ILoginSuccess &
	ILoginFailure &
	ILogout &
	ISetUser &
	ISetServices &
	ISetPreference &
	ISetLocalAuthenticated;

export function loginRequest(
	credentials: Partial<ICredentials>,
	logoutOnError?: boolean,
	isFromWebView?: boolean
): ILoginRequest {
	return {
		type: types.LOGIN.REQUEST,
		credentials,
		logoutOnError,
		isFromWebView
	};
}

export function loginSuccess(user: Partial<IUser>): ILoginSuccess {
	return {
		type: types.LOGIN.SUCCESS,
		user
	};
}

export function loginFailure(err: Record<string, any>): ILoginFailure {
	return {
		type: types.LOGIN.FAILURE,
		err
	};
}

export function logout(forcedByServer = false): ILogout {
	return {
		type: types.LOGOUT,
		forcedByServer
	};
}

export function setUser(user: Partial<IUser>): ISetUser {
	return {
		type: types.USER.SET,
		user
	};
}

export function setLoginServices(data: Record<string, any>): ISetServices {
	return {
		type: types.LOGIN.SET_SERVICES,
		data
	};
}

export function setPreference(preference: Record<string, any>): ISetPreference {
	return {
		type: types.LOGIN.SET_PREFERENCE,
		preference
	};
}

export function setLocalAuthenticated(isLocalAuthenticated: boolean): ISetLocalAuthenticated {
	return {
		type: types.LOGIN.SET_LOCAL_AUTHENTICATED,
		isLocalAuthenticated
	};
}
