export type ChemicalReference={query:string;mode:string;status:string;limited:boolean;records:{cid:number;name:string;formula:string;cas:string;iupac:string;computedMolarMass:string;fetchedAt:string|null;sourceUrl:string}[]};
export type LibraryResources={chemical?:ChemicalReference|null;links:{kind:string;title:string;href:string}[]};
