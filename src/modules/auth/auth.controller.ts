import { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { AuthUser } from "../../lib/db/entity";
import { Handle } from "../../lib/core";
import { guard } from "../../lib/middleware/authentication";

export class AuthController {
	constructor(private authService: AuthService) {}

	@Handle({
		method: "get",
		path: "/profile",
		template: "auth/profile",
		schema: {},
		middleware: [guard.authenticated],
	})
	async profile(req: Request, res: Response) {
		res.locals.user = await req.orm.em.findOneOrFail(AuthUser, req.user.uid);
	}

	@Handle({ method: "get", path: "/login", template: "auth/login" })
	async getLogin(req: Request, res: Response) {}

	@Handle({ method: "post", path: "/login" })
	async login(req: Request, res: Response) {
		try {
			res.cookie("id_token", await this.authService.generateUserToken(req.body.uid, req.body.password));
			res.redirect("/");
		} catch (e) {
			console.log(e);
			res.status(401).render("auth/login", { err: true });
		}
	}

	@Handle({ method: "get", path: "/forgot", template: "auth/forgot" })
	async getForget(req: Request, res: Response) {}

	@Handle({ method: "post", path: "/forgot" })
	async postForget(req: Request, res: Response) {
		await this.authService.requestUserPasswordReset(req.body.email);
		res.redirect("/auth/forgot/success");
	}

	@Handle({ method: "get", path: "/forgot/success", template: "auth/reset-email-sent" })
	async ForgetSuccess(req: Request, res: Response) {}

	@Handle({ method: "get", path: "/reset-password", template: "auth/password-reset-form" })
	async resetPasswordForm(req: Request, res: Response) {}

	@Handle({ method: "post", path: "/reset-password" })
	async resetPassword(req: Request, res: Response) {
		await this.authService.passwordResetConfirmation(String(req.query.token), req.body.password);
		res.redirect("/auth/login");
	}

	@Handle({ method: "get", path: "/logout" })
	async logout(req: Request, res: Response) {
		res.cookie("id_token", "", { expires: new Date() });
		res.redirect("/auth/login");
	}
}
