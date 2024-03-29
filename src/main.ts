import express from "express";
import { join } from "path";
import { InitORM, InjectORM } from "./lib/db/init";
import { logger } from "./lib/logging";
import { AddTailingSlash, Authentication, CompressionMiddleware, registerViewHelpers, SideBar } from "./lib/middleware";
import { AppRouter } from "./router";
import nunjucks from "nunjucks";

(async function () {
	const app = express();
	// configure views
	app.set("view engine", "njk");

	let view_opts = {
		autoescape: false,
		lstripBlocks: true,
		trimBlocks: true,
		express: app,
		watch: true,
	};
	var env = nunjucks.configure(join(__dirname, "./../views"), view_opts);

	function DateFilter(value: Date) {
		if (!value) {
			return "";
		}
		return new Date(value).toLocaleString("sv").substr(0, 10);
	}
	env.addFilter("date", DateFilter);

	app.use(express.urlencoded({ extended: true }));
	app.disable("x-powered-by");

	app.use(CompressionMiddleware);
	let staticOpts = { cacheControl: true, immutable: true, maxAge: 3600000 };
	app.use(express.static(join(__dirname, "../public"), process.env.PORT ? staticOpts : {}));

	app.use(AddTailingSlash, Authentication, InjectORM, registerViewHelpers, SideBar);
	// Add Router
	app.use(AppRouter);

	app.use(function (req, res) {
		res.status(404).render("error", { status_code: 404, msg: "Sorry the link is broken" });
	});

	app.use(function (err, req, res, next) {
		console.error(err);
		res.status(500).render("error", {
			status_code: 500,
			msg: "Oops Something Went Wrong",
			error: process.env.NODE_ENV == "production" ? null : err,
		});
	});

	await InitORM();

	const port = process.env.PORT || 3000;

	app.listen(port, () => logger.info("Listening on Port : " + port));
})();
