import { url } from "inspector";
import { collapseRange, decrypt, parseCookies } from "../lib/core";
import * as bcrypt from "bcryptjs";
const status = {
	asset_status: {
		NOT_IN_USE: "warn",
		IN_USE: "success",
		IN_REPAIR: "danger stale",
		DISCARDED: "danger",
	},
	asset_condition: { FUNCTIONAL: "success", BROKEN: "danger" },
	priority: {
		LOW: "success stale",
		NORMAL: "success  ",
		HIGH: "warn",
		URGENT: "danger",
	},
	bool: {
		true: "success",
		false: "danger",
	},

	ticket: {
		OPEN: "info  stale",
		BLOCKED: "danger  stale",
		RESOLVED: "success  stale",
		CLOSED: "warn  stale",
		WAITING: "info stale",
	},
};

function addAuth(app) {
	app.use(async (req, res, next) => {
		res.locals.frame = req.headers["turbo-frame"];
		try {
			req.user = await decrypt(parseCookies(req)["id_token"]);
		} catch (e) {
			if (!["/auth/login/", "/auth/forgot/"].includes(req.originalUrl)) {
				return res.redirect("/auth/login/");
			}
		}
		res.locals.title = "IT Management";
		res.locals.tag = function name(type: string, str: string) {
			return `<span class="tag ${status[type][str]}">${String(str).replace(/_/g, " ")}</span>`;
		};
		res.locals.breadcrumbs = [];
		res.locals.success_flash = [];
		res.locals.error_flash = [];
		res.locals.collapseRange = collapseRange;
		res.locals.withParam = getWithParam(req.url, req.protocol + "://" + req.headers.host);
		next();
	});
}
function getWithParam(urlstr: string, base) {
	return function (data) {
		let url = new URL(urlstr, base);
		for (const key in data) {
			if (Object.prototype.hasOwnProperty.call(data, key)) {
				const element = data[key];
				url.searchParams.set(key, element);
				if (element == null) {
					url.searchParams.delete(key);
				}
			}
		}
		return url.pathname + url.search;
	};
}
export { addAuth };
