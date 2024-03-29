import { decrypt, encrypt, IEmailService } from "../../lib/core";
import * as bcrypt from "bcryptjs";
import { UsersRepository } from "./users.repository";
import { AuthUser } from "../../lib/db/entity";

export class AuthService {
	constructor(private usersRepository: UsersRepository, private emailService: IEmailService) {}

	async generateUserToken(username: string, password: string) {
		const user = await this.usersRepository.getActiveUser(username);
		if (user && (await bcrypt.compare(password, user.password))) {
			return encrypt(JSON.stringify({ uid: user.uid }));
		} else {
			throw Error("Invalid Credentials");
		}
	}

	async requestUserPasswordReset(uid: string) {
		const user: AuthUser = await this.usersRepository.getActiveUser(uid);
		const token: string = await encrypt(JSON.stringify({ uid: user.uid, timestamp: Date.now() }));
		this.emailService.send(user.email, "Password Reset Request", "reset-password", { user, token });
	}

	async passwordResetConfirmation(token: string, password: string) {
		try {
			const decodedToken = JSON.parse(await decrypt(token));
			const user = await this.usersRepository.getActiveUser(decodedToken.uid);
			await this.usersRepository.updateUser(user.uid, { password });
		} catch (error) {
			console.log(error);;
			throw new Error("Invalid Token");
		}
	}
}
