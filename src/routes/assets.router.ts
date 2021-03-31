import { LoadStrategy, wrap } from "@mikro-orm/core";
import express from "express";
import { Asset, AssetLocation, AssetStatus, Category, Manufacturer, Supplier } from "../db/entity";
import { objToQueryString } from "../lib/core";
import { getNextVal, ID_SEQUENCES } from "./../lib/data";
const route = express.Router();

route.use((req, res, next) => {
	res.locals.breadcrumbs.push({ name: "Asset Management", link: "/assets/" });
	next();
});

// create-device
route.get("/", async (req, res) => {
	res.render("asset/asset-management-home");
});

route.get("/all", async (req, res) => {
	res.locals.breadcrumbs.push({ name: "Assets", link: "/assets/all/" });
	const params: any = {
		page: parseInt(String(req.query.page || "0")),
		size: parseInt(String(req.query.size || "10")),
		sort: Object.assign({ assetCode: "desc" }, req.query.sort),
		filter: Object.assign({}, req.query.filter),
	};
	let filter = { $or: [] };

	if (params.filter.category) {
		params.filter.category = params.filter.category.map((x) => Number(x));
		filter["category"] = params.filter.category;
	}

	if (params.filter.status) {
		filter["status"] = params.filter.status;
	}

	if (params.filter.condition) {
		filter["condition"] = params.filter.condition;
	}

	if (params.filter.search) {
		if (!params.filter.field) {
			filter.$or.push({ model: { $ilike: `%${params.filter.search.trim()}%`.trim() } });
		} else {
			if (!Array.isArray(params.filter.field)) {
				params.filter.field = [params.filter.field];
			}
			params.filter.field.forEach((element) => {
				filter.$or.push({ [element]: { $ilike: `%${params.filter.search.trim()}%`.trim() } });
			});
		}
	}
	if (params.filter.location) {
		params.filter.location = params.filter.location.map((x) => Number(x));
		filter["location"] = params.filter.location;
	}

	let [items, count] = await req.orm.em.findAndCount(Asset, filter, {
		limit: params.size,
		offset: params.page * params.size,
		orderBy: { ...params.sort },
	});

	if (req.query.selected) {
		res.locals.asset = await req.orm.em.findOne(
			Asset,
			parseInt(String(req.query.selected || "-1"))
		);
		res.locals.breadcrumbs.push({ name: res.locals.asset.assetCode });

		return res.render("asset/asset-summery", {
			items,
			total: count,
			...params,
			sort: objToQueryString({ ...params, sort: params.sort, filter: params.filter }),
		});
	}

	res.locals.asset_categories = (
		await req.orm.em.find(Category, {}, { fields: ["id", "name"], orderBy: { name: "asc" } })
	).map((x) => ({ name: x.name, id: x.id }));

	res.locals.asset_locations = (
		await req.orm.em.find(AssetLocation, {}, { fields: ["id", "name"], orderBy: { name: "asc" } })
	).map((x) => ({ name: x.name, id: x.id }));

	res.locals.client_vars = { params };
	res.locals.filterConfig = [
		{
			label: "Search Field",
			name: "field",
			type: "select",
			value: params.filter.field,
			options: [
				{ id: "assetCode", name: "Asset Code" },
				{ id: "grnNo", name: "GRN No" },
				{ id: "owner", name: "Owner" },
				{ id: "serialNo", name: "Serial No" },
			],
		},
		{ label: "Search", name: "search", type: "text", value: params.filter.search },
		{
			label: "Category",
			name: "category",
			options: res.locals.asset_categories,
			type: "select",
			multiple: true,
			value: params.filter.category,
		},
		{
			label: "Location",
			name: "location",
			options: res.locals.asset_locations,
			type: "select",
			multiple: true,
			value: params.filter.location,
		},
		{
			label: "Status",
			name: "status",
			options: [
				{ id: "NOT_IN_USE", name: "NOT IN USE" },
				{ id: "IN_USE", name: "IN USE" },
				{ id: "DISCARDED", name: "DISCARDED" },
			],
			type: "select",
			value: params.filter.status,
		},
		{
			label: "Condition",
			name: "condition",
			options: [
				{ id: "FUNCTIONAL", name: "FUNCTIONAL" },
				{ id: "BROKEN", name: "BROKEN" },
			],
			type: "select",
			value: params.filter.condition,
		},
	];

	if (req.query.download) {
		items = await req.orm.em.find(Asset, filter, {
			orderBy: { ...params.sort },
			strategy: LoadStrategy.JOINED,
		});
		return res
			.contentType("text/csv")
			.set({ "Content-Disposition": `attachment; filename=${new Date().toISOString()}.csv` })
			.send(getCSV(items));
	}

	res.render("asset/asset-list", {
		items,
		total: count,
		...params,
		sort: objToQueryString({ sort: params.sort, filter: params.filter }),
	});
});

function flattenObj(obj, parent, res = {}) {
	for (let key in obj) {
		let propName = parent ? parent + "_" + key : key;
		if (typeof obj[key] == "object") {
			flattenObj(obj[key], propName, res);
		} else {
			res[propName] = obj[key];
		}
	}
	return res;
}

function getCSV(items) {
	items = items.map((x) => flattenObj(x, null));
	const replacer = (key, value) => (value === null || value === undefined ? "" : value); // specify how you want to handle null values here
	const header = Object.keys(items[0]);
	const csv = [
		header.join(","), // header row first
		...items.map((row) =>
			header
				.map((fieldName) => String(JSON.stringify(row[fieldName], replacer)).replace(/,/, ""))
				.join(",")
		),
	].join("\r\n");
	return csv;
}

// create-device
route.get("/create", async (req, res) => {
	res.locals.asset_categories = await req.orm.em.find(Category, {});
	res.locals.asset_locations = await req.orm.em.find(AssetLocation, {});
	res.locals.asset_suppliers = await req.orm.em.find(Supplier, {});
	res.locals.asset_manufacturers = await req.orm.em.find(Manufacturer, {});
	res.render("asset/asset-form");
});

route.post("/create", async (req, res) => {
	// Object.keys(req.body).forEach((key) => (req.body[key] === "" ? delete req.body[key] : {}));
	let asset = req.orm.em.create(Asset, {});
	wrap(asset).assign(req.body, { em: req.orm.em });
	try {
		// id generation not concurrent so re try if duplicates
		asset.assetCode = await getNextVal(ID_SEQUENCES.ASSET_CODE, { prefix: "D_" });
		await req.orm.em.persistAndFlush(asset);
		res.redirect(303, req.baseUrl + "/all/");
	} catch (e) {
		console.log(e);
		let errors = {};
		res.locals.asset_categories = await req.orm.em.find(Category, {});
		res.locals.asset_locations = await req.orm.em.find(AssetLocation, {});
		res.locals.asset_suppliers = await req.orm.em.find(Supplier, {});
		res.locals.asset_manufacturers = await req.orm.em.find(Manufacturer, {});
		if (
			e.name == "UniqueConstraintViolationException" &&
			e.constraint == "asset_serial_no_unique"
		) {
			errors["serialNo"] = "Duplicate Serial Number ";
		}
		res.status(400).render("asset/asset-form", { errors, ...asset });
	}
});
route.post("/:id/print-sticker", async (req, res) => {
	let assets;
	// let asset = await req.orm.em.findOneOrFail(Asset, Number(req.params.id));
	// asset.stickerPrinted = new Date();
	// await req.orm.em.flush();
	if (req.body.type == "SINGLE") {
		assets = await req.orm.em.find(Asset, { assetCode: req.body.assetCode });
		return res.render("asset/print-stickers", {
			assets: assets,
			assetCode: req.body.assetCode,
			type: "SINGLE",
		});
	} else {
		assets = await req.orm.em.find(Asset, {
			assetCode: { $lte: req.body.to, $gte: req.body.from },
		});
		return res.render("asset/print-stickers", {
			assets: assets,
			assetCode: req.body.assetCode,
			to: req.body.to,
			from: req.body.from,
			type: "BULK",
		});
	}
});

route.get("/:id/print-sticker", async (req, res) => {
	res.render("asset/print-stickers", { assetCode: req.params.id });
});

route.get("/:id/discard", async (req, res) => {
	let asset = await req.orm.em.findOneOrFail(Asset, Number(req.params.id));
	res.render("asset/asset-discard-form", { asset });
});

route.post("/:id/discard", async (req, res) => {
	let asset = await req.orm.em.findOneOrFail(Asset, Number(req.params.id));
	asset.status = AssetStatus.DISCARDED;
	// asset.location = req.orm.em.getReference(AssetLocation, 0);
	asset.decommissionReason = req.body.reason;
	await req.orm.em.flush();
	res.redirect("/assets/all/?selected=" + asset.id);
});

route.get("/:id/status", async (req, res) => {
	let asset = await req.orm.em.findOneOrFail(Asset, Number(req.params.id));

	switch (req.query.to) {
		case "backup":
			asset.status = AssetStatus.NOT_IN_USE;
			break;
		case "in_use":
			asset.status = AssetStatus.IN_USE;
			break;
		case "discard":
			break;
		default:
			break;
	}

	await req.orm.em.flush();

	res.redirect(req.header("Referer"));
});

// edit
route.get("/:id/edit", async (req: any, res) => {
	let asset = await req.orm.em.findOneOrFail(Asset, req.params.id);
	res.locals.asset_categories = await req.orm.em.find(Category, {});
	res.locals.asset_locations = await req.orm.em.find(AssetLocation, {});
	res.locals.asset_suppliers = await req.orm.em.find(Supplier, {});
	res.locals.asset_manufacturers = await req.orm.em.find(Manufacturer, {});

	res.render("asset/asset-form", { ...asset });
});

route.post("/:id/edit", async (req, res) => {
	let supplier = await req.orm?.em.findOne(Asset, Number(req.params.id));
	supplier?.assign(req.body);
	console.log(supplier);
	await req.orm?.em.flush();
	res.redirect(303, req.baseUrl + "/all/");
});

export const AssetsRouter = route;
