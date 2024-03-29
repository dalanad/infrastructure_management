import { Cascade, Entity, ManyToOne, OneToMany, PrimaryKey, Property } from "@mikro-orm/core";
import { BaseEntity } from "./../base.entity";

@Entity({ tableName: "device_category" })
export class Category extends BaseEntity {
	@PrimaryKey() id: number;
	@Property() name: string;
	@Property({ default: false, nullable: false }) computer: boolean;
	@Property({ default: false, nullable: false }) networked: boolean;
}

@Entity({ tableName: "device_manufacturer" })
export class Manufacturer extends BaseEntity {
	@PrimaryKey() id: number;
	@Property() name: string;
}

@Entity({ tableName: "device_location_parent" })
export class AssetLocationParent extends BaseEntity {
	@PrimaryKey() id: number;
	@Property() name: string;
	@Property() description: string;

}

@Entity({ tableName: "device_location" })
export class AssetLocation extends BaseEntity {
	@PrimaryKey() id: number;
	@Property() name: string;
	@Property() floor: string;
	@Property() wing: string;

	@ManyToOne((_) => AssetLocationParent, { cascade: [Cascade.ALL], nullable: true, eager: true, })
	parent?: AssetLocationParent;

}