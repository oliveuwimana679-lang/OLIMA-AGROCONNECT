import { alias } from "drizzle-orm/pg-core";
import { and, count, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  CreateProductBody,
  CreateProductResponse,
  CreateRequestBody,
  CreateRequestResponse,
  DeleteProductParams,
  GetMarketplaceSummaryResponse,
  GetMyProfileResponse,
  ListIncomingRequestsResponse,
  ListMyProductsResponse,
  ListMyRequestsResponse,
  ListProductsQueryParams,
  ListProductsResponse,
  SaveMyProfileBody,
  SaveMyProfileResponse,
  UpdateProductBody,
  UpdateProductParams,
  UpdateProductResponse,
  UpdateRequestStatusBody,
  UpdateRequestStatusParams,
  UpdateRequestStatusResponse,
} from "@workspace/api-zod";
import {
  db,
  marketProfilesTable,
  marketRequestsTable,
  productsTable,
} from "@workspace/db";
import {
  getSupabaseAuthContext,
} from "../middlewares/supabaseAuthMiddleware";
import {
  readSupabaseProfile,
  upsertSupabaseProfile,
} from "../lib/supabase-profiles";

const router: IRouter = Router();

function authenticatedUserId(_req: Request, res: Response): string | undefined {
  const auth = getSupabaseAuthContext(res);
  if (!auth) {
    res.status(401).json({ error: "Authentication required" });
    return undefined;
  }
  return auth.userId;
}

async function getProfile(userId: string, res: Response) {
  const auth = getSupabaseAuthContext(res);
  if (!auth) {
    res.status(401).json({ error: "Authentication required" });
    return undefined;
  }
  try {
    const remoteProfile = await readSupabaseProfile(userId, auth.accessToken);
    if (
      !remoteProfile ||
      (remoteProfile.role !== "farmer" && remoteProfile.role !== "buyer") ||
      !remoteProfile.full_name?.trim()
    ) {
      return undefined;
    }

    const [marketProfile] = await db
      .insert(marketProfilesTable)
      .values({
        userId,
        role: remoteProfile.role,
        fullName: remoteProfile.full_name.trim(),
        phone: remoteProfile.phone,
        district: null,
      })
      .onConflictDoUpdate({
        target: marketProfilesTable.userId,
        set: {
          role: remoteProfile.role,
          fullName: remoteProfile.full_name.trim(),
          phone: remoteProfile.phone,
          updatedAt: new Date(),
        },
      })
      .returning();
    return marketProfile;
  } catch {
    res.status(502).json({ error: "Could not load your profile from Supabase" });
    return undefined;
  }
}

async function fetchProducts(condition?: SQL, limit?: number) {
  const query = db
    .select({
      id: productsTable.id,
      farmerId: productsTable.farmerId,
      farmerName: marketProfilesTable.fullName,
      name: productsTable.name,
      category: productsTable.category,
      description: productsTable.description,
      pricePerKg: productsTable.pricePerKg,
      quantityKg: productsTable.quantityKg,
      district: productsTable.district,
      unit: productsTable.unit,
      imageUrl: productsTable.imageUrl,
      available: productsTable.available,
      createdAt: productsTable.createdAt,
    })
    .from(productsTable)
    .innerJoin(
      marketProfilesTable,
      eq(productsTable.farmerId, marketProfilesTable.userId),
    )
    .where(condition)
    .orderBy(desc(productsTable.createdAt));
  return limit === undefined ? query : query.limit(limit);
}

async function fetchRequestRows(condition: SQL) {
  const buyers = alias(marketProfilesTable, "request_buyer");
  const farmers = alias(marketProfilesTable, "request_farmer");
  return db
    .select({
      id: marketRequestsTable.id,
      productId: marketRequestsTable.productId,
      buyerId: marketRequestsTable.buyerId,
      farmerId: marketRequestsTable.farmerId,
      quantityKg: marketRequestsTable.quantityKg,
      message: marketRequestsTable.message,
      status: marketRequestsTable.status,
      productName: productsTable.name,
      buyerName: buyers.fullName,
      farmerName: farmers.fullName,
      pricePerKg: productsTable.pricePerKg,
      createdAt: marketRequestsTable.createdAt,
    })
    .from(marketRequestsTable)
    .innerJoin(productsTable, eq(marketRequestsTable.productId, productsTable.id))
    .innerJoin(buyers, eq(marketRequestsTable.buyerId, buyers.userId))
    .innerJoin(farmers, eq(marketRequestsTable.farmerId, farmers.userId))
    .where(condition)
    .orderBy(desc(marketRequestsTable.createdAt));
}

router.get("/market/summary", async (_req, res): Promise<void> => {
  const [farmerCount, buyerCount, productCount, districtCount, featured] =
    await Promise.all([
      db
        .select({ total: count() })
        .from(marketProfilesTable)
        .where(eq(marketProfilesTable.role, "farmer")),
      db
        .select({ total: count() })
        .from(marketProfilesTable)
        .where(eq(marketProfilesTable.role, "buyer")),
      db
        .select({ total: count() })
        .from(productsTable)
        .where(eq(productsTable.available, true)),
      db
        .select({
          total: sql<number>`count(distinct ${productsTable.district})::int`,
        })
        .from(productsTable)
        .where(eq(productsTable.available, true)),
      fetchProducts(eq(productsTable.available, true), 6),
    ]);

  res.json(
    GetMarketplaceSummaryResponse.parse({
      farmers: farmerCount[0]?.total ?? 0,
      buyers: buyerCount[0]?.total ?? 0,
      products: productCount[0]?.total ?? 0,
      districts: districtCount[0]?.total ?? 0,
      featured,
    }),
  );
});

router.get("/profile", async (req, res): Promise<void> => {
  const userId = authenticatedUserId(req, res);
  if (!userId) return;

  const profile = await getProfile(userId, res);
  if (res.headersSent) return;
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  res.json(GetMyProfileResponse.parse(profile));
});

router.put("/profile", async (req, res): Promise<void> => {
  const userId = authenticatedUserId(req, res);
  if (!userId) return;

  const parsed = SaveMyProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const auth = getSupabaseAuthContext(res);
  if (!auth) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    await upsertSupabaseProfile(
      {
        id: userId,
        role: parsed.data.role,
        full_name: parsed.data.fullName.trim(),
        phone: parsed.data.phone?.trim() || null,
        email: auth.email,
      },
      auth.accessToken,
    );
  } catch {
    res.status(502).json({ error: "Could not save your profile to Supabase" });
    return;
  }

  const [profile] = await db
    .insert(marketProfilesTable)
    .values({
      userId,
      role: parsed.data.role,
      fullName: parsed.data.fullName.trim(),
      phone: parsed.data.phone?.trim() || null,
      district: parsed.data.district?.trim() || null,
    })
    .onConflictDoUpdate({
      target: marketProfilesTable.userId,
      set: {
        role: parsed.data.role,
        fullName: parsed.data.fullName.trim(),
        phone: parsed.data.phone?.trim() || null,
        district: parsed.data.district?.trim() || null,
        updatedAt: new Date(),
      },
    })
    .returning();

  res.json(SaveMyProfileResponse.parse(profile));
});

router.get("/products", async (req, res): Promise<void> => {
  const parsed = ListProductsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const filters: SQL[] = [eq(productsTable.available, true)];
  const query = parsed.data.q?.trim();
  if (query) {
    const search = `%${query}%`;
    filters.push(
      or(
        ilike(productsTable.name, search),
        ilike(productsTable.category, search),
        ilike(productsTable.description, search),
        ilike(productsTable.district, search),
      )!,
    );
  }
  if (parsed.data.category) {
    filters.push(ilike(productsTable.category, `%${parsed.data.category}%`));
  }
  if (parsed.data.district) {
    filters.push(ilike(productsTable.district, `%${parsed.data.district}%`));
  }

  const products = await fetchProducts(and(...filters));
  res.json(ListProductsResponse.parse(products));
});

router.get("/products/mine", async (req, res): Promise<void> => {
  const userId = authenticatedUserId(req, res);
  if (!userId) return;

  const profile = await getProfile(userId, res);
  if (res.headersSent) return;
  if (!profile || profile.role !== "farmer") {
    res.status(403).json({ error: "Farmer account required" });
    return;
  }

  const products = await fetchProducts(eq(productsTable.farmerId, userId));
  res.json(ListMyProductsResponse.parse(products));
});

router.post("/products", async (req, res): Promise<void> => {
  const userId = authenticatedUserId(req, res);
  if (!userId) return;

  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const profile = await getProfile(userId, res);
  if (res.headersSent) return;
  if (!profile || profile.role !== "farmer") {
    res.status(403).json({ error: "Farmer account required" });
    return;
  }

  const [created] = await db
    .insert(productsTable)
    .values({
      farmerId: userId,
      name: parsed.data.name.trim(),
      category: parsed.data.category.trim(),
      description: parsed.data.description,
      pricePerKg: parsed.data.pricePerKg,
      quantityKg: parsed.data.quantityKg,
      district: parsed.data.district.trim(),
      unit: parsed.data.unit.trim() || "kg",
      imageUrl: parsed.data.imageUrl?.trim() || null,
    })
    .returning();

  const product = { ...created, farmerName: profile.fullName };
  res.status(201).json(CreateProductResponse.parse(product));
});

router.patch("/products/:id", async (req, res): Promise<void> => {
  const userId = authenticatedUserId(req, res);
  if (!userId) return;

  const params = UpdateProductParams.safeParse(req.params);
  const parsed = UpdateProductBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    const message = !params.success
      ? params.error.message
      : !parsed.success
        ? parsed.error.message
        : "Invalid product";
    res.status(400).json({ error: message });
    return;
  }

  const profile = await getProfile(userId, res);
  if (res.headersSent) return;
  if (!profile || profile.role !== "farmer") {
    res.status(403).json({ error: "Farmer account required" });
    return;
  }

  const [updated] = await db
    .update(productsTable)
    .set({
      ...parsed.data,
      name: parsed.data.name?.trim(),
      category: parsed.data.category?.trim(),
      district: parsed.data.district?.trim(),
      unit: parsed.data.unit?.trim(),
      updatedAt: new Date(),
    })
    .where(
      and(eq(productsTable.id, params.data.id), eq(productsTable.farmerId, userId)),
    )
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.json(
    UpdateProductResponse.parse({ ...updated, farmerName: profile.fullName }),
  );
});

router.delete("/products/:id", async (req, res): Promise<void> => {
  const userId = authenticatedUserId(req, res);
  if (!userId) return;

  const params = DeleteProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(productsTable)
    .where(
      and(eq(productsTable.id, params.data.id), eq(productsTable.farmerId, userId)),
    )
    .returning({ id: productsTable.id });

  if (!deleted) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  res.sendStatus(204);
});

router.post("/requests", async (req, res): Promise<void> => {
  const userId = authenticatedUserId(req, res);
  if (!userId) return;

  const parsed = CreateRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const profile = await getProfile(userId, res);
  if (res.headersSent) return;
  if (!profile || profile.role !== "buyer") {
    res.status(403).json({ error: "Buyer account required" });
    return;
  }

  const [product] = await db
    .select()
    .from(productsTable)
    .where(
      and(
        eq(productsTable.id, parsed.data.productId),
        eq(productsTable.available, true),
      ),
    );
  if (!product) {
    res.status(404).json({ error: "Available product not found" });
    return;
  }
  if (parsed.data.quantityKg > product.quantityKg) {
    res.status(400).json({ error: "Requested quantity exceeds the available amount" });
    return;
  }

  const [created] = await db
    .insert(marketRequestsTable)
    .values({
      productId: product.id,
      buyerId: userId,
      farmerId: product.farmerId,
      quantityKg: parsed.data.quantityKg,
      message: parsed.data.message ?? "",
    })
    .returning();

  const [request] = await fetchRequestRows(eq(marketRequestsTable.id, created.id));
  res.status(201).json(CreateRequestResponse.parse(request));
});

router.get("/requests/mine", async (req, res): Promise<void> => {
  const userId = authenticatedUserId(req, res);
  if (!userId) return;

  const profile = await getProfile(userId, res);
  if (res.headersSent) return;
  if (!profile || profile.role !== "buyer") {
    res.status(403).json({ error: "Buyer account required" });
    return;
  }

  const requests = await fetchRequestRows(eq(marketRequestsTable.buyerId, userId));
  res.json(ListMyRequestsResponse.parse(requests));
});

router.get("/requests/incoming", async (req, res): Promise<void> => {
  const userId = authenticatedUserId(req, res);
  if (!userId) return;

  const profile = await getProfile(userId, res);
  if (res.headersSent) return;
  if (!profile || profile.role !== "farmer") {
    res.status(403).json({ error: "Farmer account required" });
    return;
  }

  const requests = await fetchRequestRows(eq(marketRequestsTable.farmerId, userId));
  res.json(ListIncomingRequestsResponse.parse(requests));
});

router.patch("/requests/:id", async (req, res): Promise<void> => {
  const userId = authenticatedUserId(req, res);
  if (!userId) return;

  const params = UpdateRequestStatusParams.safeParse(req.params);
  const parsed = UpdateRequestStatusBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    const message = !params.success
      ? params.error.message
      : !parsed.success
        ? parsed.error.message
        : "Invalid request status";
    res.status(400).json({ error: message });
    return;
  }

  const profile = await getProfile(userId, res);
  if (res.headersSent) return;
  if (!profile || profile.role !== "farmer") {
    res.status(403).json({ error: "Farmer account required" });
    return;
  }

  const [updated] = await db
    .update(marketRequestsTable)
    .set({ status: parsed.data.status, updatedAt: new Date() })
    .where(
      and(
        eq(marketRequestsTable.id, params.data.id),
        eq(marketRequestsTable.farmerId, userId),
        eq(marketRequestsTable.status, "pending"),
      ),
    )
    .returning({ id: marketRequestsTable.id });

  if (!updated) {
    res.status(404).json({ error: "Pending request not found" });
    return;
  }

  const [request] = await fetchRequestRows(
    eq(marketRequestsTable.id, updated.id),
  );
  res.json(UpdateRequestStatusResponse.parse(request));
});

export default router;