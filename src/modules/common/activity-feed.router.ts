import express from "express";
import { orm } from "../../lib/db/init";
import { ActivityFeed, AuthUser } from "../../lib/db/entity";
import { postActivity } from "./activity-feed";

const route = express.Router();
route.get("/:id", async (req, res) => {
	let feed = await orm.em.findOne(ActivityFeed, req.params.id);
	res.locals.feed = { ...feed };
	if (feed) {
		res.locals.feed.activities = await feed.activities.init({ orderBy: { createdAt: "asc" } });
	}
	res.locals.feed.id = req.params.id;
	res.render("activity-feed/feed");
});

route.post("/:id", async (req, res) => {
	await postActivity(req.params.id, {
		user: orm.em.getReference(AuthUser, req.user.uid),
		meta: { action: "comment" },
		content: { body: String(req.body.content).trim() },
	});
	await orm.em.flush();
	res.redirect(req.originalUrl);
});

export const ActivityFeedRouter = route;
