--
-- PostgreSQL database dump
--

\restrict OeXJEna3j13WLjj36GQcptcaAcIqMtQfuWYpSea7sCednP2q8sfRixb0a0UNCtI

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

-- Started on 2025-10-06 19:11:02

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 2 (class 3079 OID 105909)
-- Name: postgis; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;


--
-- TOC entry 6777 (class 0 OID 0)
-- Dependencies: 2
-- Name: EXTENSION postgis; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION postgis IS 'PostGIS geometry and geography spatial types and functions';


--
-- TOC entry 3 (class 3079 OID 106989)
-- Name: postgis_raster; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis_raster WITH SCHEMA public;


--
-- TOC entry 6778 (class 0 OID 0)
-- Dependencies: 3
-- Name: EXTENSION postgis_raster; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION postgis_raster IS 'PostGIS raster types and functions';


--
-- TOC entry 1340 (class 1255 OID 107546)
-- Name: enforce_user_role_scope(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.enforce_user_role_scope() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE v_scope text;
BEGIN
  SELECT scope INTO v_scope FROM public.roles WHERE id = NEW.role_id;
  IF v_scope = 'system' AND NEW.tenant_id IS NOT NULL THEN
    RAISE EXCEPTION 'users(%) has system role (%) but tenant_id = % (must be NULL)', NEW.id, NEW.role_id, NEW.tenant_id;
  ELSIF v_scope = 'tenant' AND NEW.tenant_id IS NULL THEN
    RAISE EXCEPTION 'users(%) has tenant role (%) but tenant_id is NULL (must be set)', NEW.id, NEW.role_id;
  END IF;
  RETURN NEW;
END $$;


ALTER FUNCTION public.enforce_user_role_scope() OWNER TO postgres;

--
-- TOC entry 700 (class 1255 OID 107547)
-- Name: evaluate_pass_fail(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.evaluate_pass_fail() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    t_min numeric;
    t_max numeric;
BEGIN
    -- Try lookup by threshold_id if present
    IF NEW.threshold_id IS NOT NULL THEN
        SELECT min_value, max_value
          INTO t_min, t_max
          FROM parameter_thresholds
         WHERE id = NEW.threshold_id;
    ELSE
        -- Fallback by param + class (unit removed)
        SELECT min_value, max_value
          INTO t_min, t_max
          FROM parameter_thresholds
         WHERE parameter_id = NEW.parameter_id
           AND class_code   = NEW.evaluated_class_code
         LIMIT 1;
    END IF;

    -- If nothing found, leave pass_fail NULL
    IF NOT FOUND THEN
        NEW.pass_fail := NULL;
        RETURN NEW;
    END IF;

    -- Evaluate: pass if within [t_min, t_max] (NULLs treated as open bounds)
    IF (t_min IS NULL OR NEW.value >= t_min)
       AND (t_max IS NULL OR NEW.value <= t_max) THEN
        NEW.pass_fail := 'pass';
    ELSE
        NEW.pass_fail := 'fail';
    END IF;

    NEW.evaluated_at := now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.evaluate_pass_fail() OWNER TO postgres;

--
-- TOC entry 1025 (class 1255 OID 107548)
-- Name: fn_active_lake_geom(bigint); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_active_lake_geom(p_lake_id bigint) RETURNS public.geometry
    LANGUAGE sql STABLE
    AS $$
  SELECT ST_Multi(ST_Force2D(ST_MakeValid(ly.geom)))
  FROM layers ly
  WHERE ly.body_type = 'lake'
    AND ly.body_id   = p_lake_id
    AND ly.is_active = TRUE
  ORDER BY ly.id DESC
  LIMIT 1;
$$;


ALTER FUNCTION public.fn_active_lake_geom(p_lake_id bigint) OWNER TO postgres;

--
-- TOC entry 324 (class 1255 OID 107549)
-- Name: fn_lake_geom_from_layer(bigint); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_lake_geom_from_layer(p_layer_id bigint) RETURNS public.geometry
    LANGUAGE sql STABLE
    AS $$
  SELECT ST_Multi(ST_Force2D(ST_MakeValid(ly.geom)))
  FROM layers ly
  WHERE ly.id = p_layer_id
    AND ly.body_type = 'lake'
    AND ly.geom IS NOT NULL
  LIMIT 1;
$$;


ALTER FUNCTION public.fn_lake_geom_from_layer(p_layer_id bigint) OWNER TO postgres;

--
-- TOC entry 449 (class 1255 OID 107550)
-- Name: fn_lake_ring_resolved(bigint, numeric, bigint); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_lake_ring_resolved(p_lake_id bigint, p_radius_km numeric, p_layer_id bigint DEFAULT NULL::bigint) RETURNS public.geometry
    LANGUAGE sql STABLE
    AS $$
  WITH g AS (SELECT fn_resolved_lake_geom(p_lake_id, p_layer_id) AS geom)
  SELECT ST_Difference(
           ST_Buffer((SELECT geom FROM g)::geography, p_radius_km*1000)::geometry,
           (SELECT geom FROM g)
         );
$$;


ALTER FUNCTION public.fn_lake_ring_resolved(p_lake_id bigint, p_radius_km numeric, p_layer_id bigint) OWNER TO postgres;

--
-- TOC entry 1396 (class 1255 OID 107551)
-- Name: fn_resolved_lake_geom(bigint, bigint); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_resolved_lake_geom(p_lake_id bigint, p_layer_id bigint) RETURNS public.geometry
    LANGUAGE sql STABLE
    AS $$
  SELECT COALESCE(
           fn_lake_geom_from_layer(p_layer_id),
           fn_active_lake_geom(p_lake_id)
         );
$$;


ALTER FUNCTION public.fn_resolved_lake_geom(p_lake_id bigint, p_layer_id bigint) OWNER TO postgres;

--
-- TOC entry 641 (class 1255 OID 107552)
-- Name: layers_on_activate(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.layers_on_activate() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.is_active IS TRUE THEN
    UPDATE layers
       SET is_active = FALSE, updated_at = now()
     WHERE body_type = NEW.body_type
       AND body_id   = NEW.body_id
       AND id       <> NEW.id
       AND is_active = TRUE;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.layers_on_activate() OWNER TO postgres;

--
-- TOC entry 1331 (class 1255 OID 107553)
-- Name: pop__valid_table_name(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.pop__valid_table_name(p text) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $_$
  SELECT p ~ '^[A-Za-z_][A-Za-z0-9_\.]*$';
$_$;


ALTER FUNCTION public.pop__valid_table_name(p text) OWNER TO postgres;

--
-- TOC entry 1255 (class 1255 OID 107554)
-- Name: pop_disable_dataset(bigint); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.pop_disable_dataset(p_id bigint) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE pop_dataset_catalog
  SET is_active = FALSE, is_default = FALSE, disabled_at = now()
  WHERE id = p_id;
END$$;


ALTER FUNCTION public.pop_disable_dataset(p_id bigint) OWNER TO postgres;

--
-- TOC entry 1079 (class 1255 OID 107555)
-- Name: pop_drop_dataset(bigint); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.pop_drop_dataset(p_id bigint) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE v_tbl TEXT;
BEGIN
  SELECT table_name INTO v_tbl FROM pop_dataset_catalog WHERE id = p_id;
  IF v_tbl IS NULL THEN RAISE EXCEPTION 'Dataset not found: %', p_id; END IF;

  EXECUTE format('DROP TABLE IF EXISTS %s', v_tbl);
  DELETE FROM pop_dataset_catalog WHERE id = p_id;
  DELETE FROM pop_estimate_cache WHERE method LIKE format('raster_counts:ds=%s%%', p_id::text);
END$$;


ALTER FUNCTION public.pop_drop_dataset(p_id bigint) OWNER TO postgres;

--
-- TOC entry 1094 (class 1255 OID 108305)
-- Name: pop_enable_dataset(bigint, boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.pop_enable_dataset(p_id bigint, p_make_default boolean) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Enable the dataset
  UPDATE pop_dataset_catalog SET is_enabled = TRUE, updated_at = now() WHERE id = p_id;
  IF p_make_default THEN
    -- unset defaults for same year
    UPDATE pop_dataset_catalog SET is_default = FALSE WHERE year = (SELECT year FROM pop_dataset_catalog WHERE id = p_id) AND id <> p_id;
    -- set this as default
    UPDATE pop_dataset_catalog SET is_default = TRUE, updated_at = now() WHERE id = p_id;
  END IF;
END;
$$;


ALTER FUNCTION public.pop_enable_dataset(p_id bigint, p_make_default boolean) OWNER TO postgres;

--
-- TOC entry 1111 (class 1255 OID 107557)
-- Name: pop_estimate_counts_by_dataset_cached(bigint, numeric, bigint, bigint); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.pop_estimate_counts_by_dataset_cached(p_lake_id bigint, p_radius_km numeric, p_dataset_id bigint, p_layer_id bigint DEFAULT NULL::bigint) RETURNS double precision
    LANGUAGE plpgsql
    AS $_$
DECLARE
  v_tbl    TEXT := pop_table_for_id(p_dataset_id);
  v_year   SMALLINT;
  v_method TEXT := 'raster_counts:ds='||p_dataset_id::text||'|layer='||COALESCE(p_layer_id::text,'active');
  v_ring   geometry;
  v        DOUBLE PRECISION;
BEGIN
  IF v_tbl IS NULL THEN
    RAISE EXCEPTION 'Dataset % is not active or does not exist', p_dataset_id;
  END IF;

  SELECT year INTO v_year FROM pop_dataset_catalog WHERE id = p_dataset_id;
  IF v_year IS NULL THEN RAISE EXCEPTION 'Dataset % has no year', p_dataset_id; END IF;

  SELECT estimate INTO v
  FROM pop_estimate_cache
  WHERE lake_id = p_lake_id AND year = v_year
    AND radius_km = p_radius_km AND method = v_method;

  IF v IS NOT NULL THEN RETURN v; END IF;

  SELECT fn_lake_ring_resolved(p_lake_id, p_radius_km, p_layer_id) INTO v_ring;
  IF v_ring IS NULL THEN RAISE EXCEPTION 'No boundary geometry resolved for lake %', p_lake_id; END IF;

  EXECUTE format($SQL$
    WITH tiles AS (
      SELECT rast FROM %I r
      WHERE ST_Intersects(r.rast, $1)
    ),
    pix AS (
      SELECT (p).geom::geometry AS cell_geom,
             NULLIF((p).val::double precision, ST_BandNoDataValue(rast,1)) AS ppl
      FROM tiles
      CROSS JOIN LATERAL ST_PixelAsPolygons(rast,1) AS p
      WHERE (p).val IS NOT NULL
    ),
    inter AS (
      SELECT ppl,
             ST_Area(ST_Intersection(cell_geom::geography,$1::geography)) AS iarea_m2,
             ST_Area(cell_geom::geography) AS carea_m2
      FROM pix
      WHERE ppl IS NOT NULL AND ST_Intersects(cell_geom,$1)
    )
    SELECT COALESCE(SUM((iarea_m2/NULLIF(carea_m2,0))*ppl),0)
    FROM inter
    WHERE iarea_m2>0
  $SQL$, v_tbl)
  INTO v USING v_ring;

  INSERT INTO pop_estimate_cache(lake_id, year, radius_km, estimate, method)
  VALUES (p_lake_id, v_year, p_radius_km, v, v_method)
  ON CONFLICT (lake_id, year, radius_km, method)
  DO UPDATE SET estimate = EXCLUDED.estimate, computed_at = now();

  RETURN v;
END$_$;


ALTER FUNCTION public.pop_estimate_counts_by_dataset_cached(p_lake_id bigint, p_radius_km numeric, p_dataset_id bigint, p_layer_id bigint) OWNER TO postgres;

--
-- TOC entry 1046 (class 1255 OID 107558)
-- Name: pop_estimate_counts_by_year_cached(bigint, numeric, smallint, bigint); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.pop_estimate_counts_by_year_cached(p_lake_id bigint, p_radius_km numeric, p_year smallint, p_layer_id bigint DEFAULT NULL::bigint) RETURNS double precision
    LANGUAGE plpgsql
    AS $$
DECLARE v_ds_id BIGINT;
BEGIN
  SELECT id INTO v_ds_id
  FROM pop_dataset_catalog
  WHERE year = p_year AND is_active = TRUE AND is_default = TRUE
  ORDER BY id DESC
  LIMIT 1;

  IF v_ds_id IS NULL THEN
    RAISE EXCEPTION 'No active default dataset for year %', p_year;
  END IF;

  RETURN pop_estimate_counts_by_dataset_cached(p_lake_id, p_radius_km, v_ds_id, p_layer_id);
END$$;


ALTER FUNCTION public.pop_estimate_counts_by_year_cached(p_lake_id bigint, p_radius_km numeric, p_year smallint, p_layer_id bigint) OWNER TO postgres;

--
-- TOC entry 1062 (class 1255 OID 108056)
-- Name: pop_mvt_tile_by_year(integer, integer, integer, bigint, numeric, smallint, bigint); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.pop_mvt_tile_by_year(p_z integer, p_x integer, p_y integer, p_lake_id bigint, p_radius_km numeric, p_year smallint, p_layer_id bigint DEFAULT NULL::bigint) RETURNS bytea
    LANGUAGE plpgsql
    AS $_$
DECLARE
  v_tbl text := pop_table_for_year(p_year);
  v_schema text; v_table text; v_qname text;
  v_ring geometry; v_mvt bytea;
BEGIN
  IF v_tbl IS NULL THEN RETURN NULL; END IF;
  IF position('.' IN v_tbl) > 0 THEN
    v_schema := split_part(v_tbl,'.',1); v_table := split_part(v_tbl,'.',2);
    v_qname := format('%I.%I', v_schema, v_table);
  ELSE
    v_qname := format('%I', v_tbl);
  END IF;

  SELECT fn_lake_ring_resolved(p_lake_id, p_radius_km, p_layer_id) INTO v_ring;
  IF v_ring IS NULL THEN RETURN NULL; END IF;

  EXECUTE format($SQL$
    WITH env AS (SELECT ST_TileEnvelope($1,$2,$3) AS g3857),
    env4326 AS (SELECT ST_Transform(g3857,4326) g4326 FROM env),
    tiles AS (
      SELECT ST_Clip(rast,(SELECT g4326 FROM env4326)) rast
      FROM %s r
      WHERE ST_Intersects(r.rast,(SELECT g4326 FROM env4326)) AND ST_Intersects(r.rast,$4)
    ),
    pts AS (
      SELECT (pp).geom::geometry(Point,4326) g4326,
             NULLIF((pp).val::float8, ST_BandNoDataValue(rast,1)) pop
      FROM tiles CROSS JOIN LATERAL ST_PixelAsPoints(rast,1) pp
      WHERE (pp).val IS NOT NULL
    ),
    clipped AS (
      SELECT g4326, pop FROM pts
      WHERE pop IS NOT NULL AND ST_Intersects(g4326,$4)
    ),
    mvtgeom AS (
      SELECT ST_AsMVTGeom(ST_Transform(g4326,3857),(SELECT g3857 FROM env),4096,64,TRUE) geom, pop
      FROM clipped
    )
    SELECT ST_AsMVT(mvtgeom,'pop',4096,'geom') FROM mvtgeom
  $SQL$, v_qname)
  INTO v_mvt USING p_z,p_x,p_y,v_ring;

  RETURN v_mvt;
END$_$;


ALTER FUNCTION public.pop_mvt_tile_by_year(p_z integer, p_x integer, p_y integer, p_lake_id bigint, p_radius_km numeric, p_year smallint, p_layer_id bigint) OWNER TO postgres;

--
-- TOC entry 1302 (class 1255 OID 107559)
-- Name: pop_register_dataset(text, smallint, text, text, boolean, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.pop_register_dataset(p_table_name text, p_year smallint, p_source text DEFAULT 'worldpop'::text, p_release text DEFAULT NULL::text, p_is_default boolean DEFAULT true, p_note text DEFAULT NULL::text) RETURNS bigint
    LANGUAGE plpgsql
    AS $$
DECLARE v_id BIGINT;
BEGIN
  IF NOT pop__valid_table_name(p_table_name) THEN
    RAISE EXCEPTION 'Invalid table_name: %', p_table_name;
  END IF;

  IF p_is_default THEN
    UPDATE pop_dataset_catalog SET is_default = FALSE
    WHERE year = p_year AND is_default = TRUE;
  END IF;

  INSERT INTO pop_dataset_catalog(table_name, year, source, release, is_active, is_default, note)
  VALUES (p_table_name, p_year, p_source, p_release, TRUE, COALESCE(p_is_default, TRUE), p_note)
  ON CONFLICT (table_name) DO UPDATE
    SET year = EXCLUDED.year,
        source = EXCLUDED.source,
        release = EXCLUDED.release,
        is_active = TRUE,
        is_default = EXCLUDED.is_default,
        note = EXCLUDED.note
  RETURNING id INTO v_id;

  RETURN v_id;
END$$;


ALTER FUNCTION public.pop_register_dataset(p_table_name text, p_year smallint, p_source text, p_release text, p_is_default boolean, p_note text) OWNER TO postgres;

--
-- TOC entry 928 (class 1255 OID 107560)
-- Name: pop_table_for_id(bigint); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.pop_table_for_id(p_id bigint) RETURNS text
    LANGUAGE sql STABLE
    AS $$
  SELECT table_name
  FROM pop_dataset_catalog
  WHERE id = p_id AND is_active = TRUE
  LIMIT 1;
$$;


ALTER FUNCTION public.pop_table_for_id(p_id bigint) OWNER TO postgres;

--
-- TOC entry 790 (class 1255 OID 107561)
-- Name: pop_table_for_year(smallint); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.pop_table_for_year(p_year smallint) RETURNS text
    LANGUAGE sql STABLE
    AS $$
  SELECT table_name
  FROM pop_dataset_catalog
  WHERE year = p_year AND is_active = TRUE AND is_default = TRUE
  ORDER BY id DESC
  LIMIT 1;
$$;


ALTER FUNCTION public.pop_table_for_year(p_year smallint) OWNER TO postgres;

--
-- TOC entry 534 (class 1255 OID 107562)
-- Name: trg_se_inherit_station_geom(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.trg_se_inherit_station_geom() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- If a station is set and no ad-hoc geom was provided, inherit the station point
  IF NEW.station_id IS NOT NULL AND NEW.geom_point IS NULL THEN
    SELECT s.geom_point INTO NEW.geom_point
    FROM public.stations s
    WHERE s.id = NEW.station_id;
  END IF;
  RETURN NEW;
END$$;


ALTER FUNCTION public.trg_se_inherit_station_geom() OWNER TO postgres;

--
-- TOC entry 446 (class 1255 OID 107563)
-- Name: trg_set_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.trg_set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.trg_set_updated_at() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 278 (class 1259 OID 108059)
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_logs (
    id bigint NOT NULL,
    event_at timestamp(0) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    actor_id bigint,
    tenant_id bigint,
    model_type character varying(255) NOT NULL,
    model_id character varying(255) NOT NULL,
    action character varying(40) NOT NULL,
    request_id uuid,
    ip_address character varying(45),
    user_agent character varying(255),
    before json,
    after json,
    diff_keys json,
    meta json,
    hash character(64)
);


ALTER TABLE public.audit_logs OWNER TO postgres;

--
-- TOC entry 277 (class 1259 OID 108058)
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.audit_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.audit_logs_id_seq OWNER TO postgres;

--
-- TOC entry 6779 (class 0 OID 0)
-- Dependencies: 277
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- TOC entry 234 (class 1259 OID 107564)
-- Name: cache; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cache (
    key character varying(255) NOT NULL,
    value text NOT NULL,
    expiration integer NOT NULL
);


ALTER TABLE public.cache OWNER TO postgres;

--
-- TOC entry 235 (class 1259 OID 107569)
-- Name: cache_locks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cache_locks (
    key character varying(255) NOT NULL,
    owner character varying(255) NOT NULL,
    expiration integer NOT NULL
);


ALTER TABLE public.cache_locks OWNER TO postgres;

--
-- TOC entry 236 (class 1259 OID 107574)
-- Name: email_otps_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.email_otps_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.email_otps_id_seq OWNER TO postgres;

--
-- TOC entry 237 (class 1259 OID 107575)
-- Name: email_otps; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.email_otps (
    id bigint DEFAULT nextval('public.email_otps_id_seq'::regclass) NOT NULL,
    email character varying(255) NOT NULL,
    purpose character varying(255) NOT NULL,
    code_hash character varying(64) NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    last_sent_at timestamp without time zone NOT NULL,
    attempts smallint DEFAULT 0 NOT NULL,
    consumed_at timestamp without time zone,
    payload json,
    created_at timestamp without time zone,
    updated_at timestamp without time zone,
    CONSTRAINT email_otps_purpose_check CHECK (((purpose)::text = ANY ((ARRAY['register'::character varying, 'reset'::character varying])::text[])))
);


ALTER TABLE public.email_otps OWNER TO postgres;

--
-- TOC entry 238 (class 1259 OID 107583)
-- Name: failed_jobs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.failed_jobs (
    id bigint NOT NULL,
    uuid character varying(255) NOT NULL,
    connection text NOT NULL,
    queue text NOT NULL,
    payload text NOT NULL,
    exception text NOT NULL,
    failed_at timestamp(0) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.failed_jobs OWNER TO postgres;

--
-- TOC entry 239 (class 1259 OID 107589)
-- Name: failed_jobs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.failed_jobs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.failed_jobs_id_seq OWNER TO postgres;

--
-- TOC entry 6780 (class 0 OID 0)
-- Dependencies: 239
-- Name: failed_jobs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.failed_jobs_id_seq OWNED BY public.failed_jobs.id;


--
-- TOC entry 280 (class 1259 OID 108084)
-- Name: feedback; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.feedback (
    id bigint NOT NULL,
    user_id bigint,
    tenant_id bigint,
    is_guest boolean DEFAULT false NOT NULL,
    guest_name character varying(120),
    guest_email character varying(160),
    title character varying(160) NOT NULL,
    message text NOT NULL,
    category character varying(60),
    status character varying(24) DEFAULT 'open'::character varying NOT NULL,
    metadata json,
    admin_response text,
    spam_score smallint DEFAULT '0'::smallint NOT NULL,
    resolved_at timestamp(0) without time zone,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


ALTER TABLE public.feedback OWNER TO postgres;

--
-- TOC entry 279 (class 1259 OID 108083)
-- Name: feedback_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.feedback_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.feedback_id_seq OWNER TO postgres;

--
-- TOC entry 6781 (class 0 OID 0)
-- Dependencies: 279
-- Name: feedback_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.feedback_id_seq OWNED BY public.feedback.id;


--
-- TOC entry 240 (class 1259 OID 107590)
-- Name: job_batches; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.job_batches (
    id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    total_jobs integer NOT NULL,
    pending_jobs integer NOT NULL,
    failed_jobs integer NOT NULL,
    failed_job_ids text NOT NULL,
    options text,
    cancelled_at integer,
    created_at integer NOT NULL,
    finished_at integer
);


ALTER TABLE public.job_batches OWNER TO postgres;

--
-- TOC entry 241 (class 1259 OID 107595)
-- Name: jobs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.jobs (
    id bigint NOT NULL,
    queue character varying(255) NOT NULL,
    payload text NOT NULL,
    attempts smallint NOT NULL,
    reserved_at integer,
    available_at integer NOT NULL,
    created_at integer NOT NULL
);


ALTER TABLE public.jobs OWNER TO postgres;

--
-- TOC entry 242 (class 1259 OID 107600)
-- Name: jobs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.jobs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.jobs_id_seq OWNER TO postgres;

--
-- TOC entry 6782 (class 0 OID 0)
-- Dependencies: 242
-- Name: jobs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.jobs_id_seq OWNED BY public.jobs.id;


--
-- TOC entry 243 (class 1259 OID 107601)
-- Name: lakes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lakes (
    id bigint NOT NULL,
    watershed_id bigint,
    name text NOT NULL,
    alt_name text,
    region text,
    province text,
    municipality text,
    surface_area_km2 numeric,
    elevation_m numeric,
    mean_depth_m numeric,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    class_code text
);


ALTER TABLE public.lakes OWNER TO postgres;

--
-- TOC entry 244 (class 1259 OID 107608)
-- Name: lakes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.lakes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.lakes_id_seq OWNER TO postgres;

--
-- TOC entry 6783 (class 0 OID 0)
-- Dependencies: 244
-- Name: lakes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.lakes_id_seq OWNED BY public.lakes.id;


--
-- TOC entry 245 (class 1259 OID 107609)
-- Name: layers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.layers (
    id bigint NOT NULL,
    body_type text NOT NULL,
    body_id bigint NOT NULL,
    uploaded_by bigint,
    name text NOT NULL,
    type text DEFAULT 'base'::text NOT NULL,
    category text,
    srid integer DEFAULT 4326 NOT NULL,
    visibility text DEFAULT 'admin'::text NOT NULL,
    is_active boolean DEFAULT false NOT NULL,
    notes text,
    source_type text DEFAULT 'geojson'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    geom public.geometry(MultiPolygon,4326),
    bbox public.geometry(Polygon,4326) GENERATED ALWAYS AS (public.st_envelope(geom)) STORED,
    area_km2 numeric(14,3) GENERATED ALWAYS AS ((public.st_area((geom)::public.geography) / (1000000.0)::double precision)) STORED,
    CONSTRAINT chk_layers_visibility CHECK ((visibility = ANY (ARRAY['admin'::text, 'public'::text])))
);


ALTER TABLE public.layers OWNER TO postgres;

--
-- TOC entry 246 (class 1259 OID 107626)
-- Name: layers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.layers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.layers_id_seq OWNER TO postgres;

--
-- TOC entry 6784 (class 0 OID 0)
-- Dependencies: 246
-- Name: layers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.layers_id_seq OWNED BY public.layers.id;


--
-- TOC entry 247 (class 1259 OID 107627)
-- Name: migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.migrations (
    id integer NOT NULL,
    migration character varying(255) NOT NULL,
    batch integer NOT NULL
);


ALTER TABLE public.migrations OWNER TO postgres;

--
-- TOC entry 248 (class 1259 OID 107630)
-- Name: migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.migrations_id_seq OWNER TO postgres;

--
-- TOC entry 6785 (class 0 OID 0)
-- Dependencies: 248
-- Name: migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.migrations_id_seq OWNED BY public.migrations.id;


--
-- TOC entry 249 (class 1259 OID 107637)
-- Name: parameter_thresholds; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.parameter_thresholds (
    id bigint NOT NULL,
    parameter_id bigint NOT NULL,
    class_code text NOT NULL,
    min_value double precision,
    max_value double precision,
    notes text,
    standard_id bigint
);


ALTER TABLE public.parameter_thresholds OWNER TO postgres;

--
-- TOC entry 250 (class 1259 OID 107642)
-- Name: parameter_thresholds_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.parameter_thresholds_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.parameter_thresholds_id_seq OWNER TO postgres;

--
-- TOC entry 6786 (class 0 OID 0)
-- Dependencies: 250
-- Name: parameter_thresholds_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.parameter_thresholds_id_seq OWNED BY public.parameter_thresholds.id;


--
-- TOC entry 251 (class 1259 OID 107643)
-- Name: parameters; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.parameters (
    id bigint NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    unit text,
    category text,
    "group" text,
    data_type text,
    evaluation_type text,
    is_active boolean DEFAULT true NOT NULL,
    notes text
);


ALTER TABLE public.parameters OWNER TO postgres;

--
-- TOC entry 252 (class 1259 OID 107649)
-- Name: parameters_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.parameters_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.parameters_id_seq OWNER TO postgres;

--
-- TOC entry 6787 (class 0 OID 0)
-- Dependencies: 252
-- Name: parameters_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.parameters_id_seq OWNED BY public.parameters.id;


--
-- TOC entry 253 (class 1259 OID 107650)
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.password_reset_tokens (
    email character varying(255) NOT NULL,
    token character varying(255) NOT NULL,
    created_at timestamp(0) without time zone
);


ALTER TABLE public.password_reset_tokens OWNER TO postgres;

--
-- TOC entry 254 (class 1259 OID 107655)
-- Name: personal_access_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.personal_access_tokens (
    id bigint NOT NULL,
    tokenable_type character varying(255) NOT NULL,
    tokenable_id bigint NOT NULL,
    name text NOT NULL,
    token character varying(64) NOT NULL,
    abilities text,
    last_used_at timestamp(0) without time zone,
    expires_at timestamp(0) without time zone,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


ALTER TABLE public.personal_access_tokens OWNER TO postgres;

--
-- TOC entry 255 (class 1259 OID 107660)
-- Name: personal_access_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.personal_access_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.personal_access_tokens_id_seq OWNER TO postgres;

--
-- TOC entry 6788 (class 0 OID 0)
-- Dependencies: 255
-- Name: personal_access_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.personal_access_tokens_id_seq OWNED BY public.personal_access_tokens.id;


--
-- TOC entry 287 (class 1259 OID 108503)
-- Name: pop_counts_2025_1; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pop_counts_2025_1 (
    rid integer NOT NULL,
    rast public.raster,
    CONSTRAINT enforce_height_rast CHECK ((public.st_height(rast) = ANY (ARRAY[256, 193]))),
    CONSTRAINT enforce_nodata_values_rast CHECK ((public._raster_constraint_nodata_values(rast) = '{-99999.0000000000}'::numeric[])),
    CONSTRAINT enforce_num_bands_rast CHECK ((public.st_numbands(rast) = 1)),
    CONSTRAINT enforce_out_db_rast CHECK ((public._raster_constraint_out_db(rast) = '{f}'::boolean[])),
    CONSTRAINT enforce_pixel_types_rast CHECK ((public._raster_constraint_pixel_types(rast) = '{32BF}'::text[])),
    CONSTRAINT enforce_same_alignment_rast CHECK (public.st_samealignment(rast, '010000000013DDEB0F1111813F13DDEB0F111181BF89A8363F444C5E402D2F38040020354000000000000000000000000000000000E610000001000100'::public.raster)),
    CONSTRAINT enforce_scalex_rast CHECK ((round((public.st_scalex(rast))::numeric, 10) = round(0.0083333333, 10))),
    CONSTRAINT enforce_scaley_rast CHECK ((round((public.st_scaley(rast))::numeric, 10) = round((- 0.0083333333), 10))),
    CONSTRAINT enforce_srid_rast CHECK ((public.st_srid(rast) = 4326)),
    CONSTRAINT enforce_width_rast CHECK ((public.st_width(rast) = ANY (ARRAY[256, 138])))
);


ALTER TABLE public.pop_counts_2025_1 OWNER TO postgres;

--
-- TOC entry 286 (class 1259 OID 108502)
-- Name: pop_counts_2025_1_rid_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.pop_counts_2025_1_rid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pop_counts_2025_1_rid_seq OWNER TO postgres;

--
-- TOC entry 6789 (class 0 OID 0)
-- Dependencies: 286
-- Name: pop_counts_2025_1_rid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.pop_counts_2025_1_rid_seq OWNED BY public.pop_counts_2025_1.rid;


--
-- TOC entry 285 (class 1259 OID 108293)
-- Name: pop_dataset_catalog; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pop_dataset_catalog (
    id bigint NOT NULL,
    year smallint NOT NULL,
    table_name text NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


ALTER TABLE public.pop_dataset_catalog OWNER TO postgres;

--
-- TOC entry 284 (class 1259 OID 108292)
-- Name: pop_dataset_catalog_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.pop_dataset_catalog_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pop_dataset_catalog_id_seq OWNER TO postgres;

--
-- TOC entry 6790 (class 0 OID 0)
-- Dependencies: 284
-- Name: pop_dataset_catalog_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.pop_dataset_catalog_id_seq OWNED BY public.pop_dataset_catalog.id;


--
-- TOC entry 256 (class 1259 OID 107672)
-- Name: pop_estimate_cache; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pop_estimate_cache (
    lake_id bigint NOT NULL,
    year smallint NOT NULL,
    radius_km numeric(6,2) NOT NULL,
    estimate double precision NOT NULL,
    method text DEFAULT 'raster_area_weighted_counts'::text NOT NULL,
    computed_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.pop_estimate_cache OWNER TO postgres;

--
-- TOC entry 283 (class 1259 OID 108255)
-- Name: population_rasters; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.population_rasters (
    id bigint NOT NULL,
    year smallint NOT NULL,
    filename character varying(255) NOT NULL,
    disk character varying(255) DEFAULT 'local'::character varying NOT NULL,
    path character varying(255) NOT NULL,
    srid integer,
    pixel_size_x numeric(12,6),
    pixel_size_y numeric(12,6),
    uploaded_by bigint,
    status character varying(255) DEFAULT 'uploaded'::character varying NOT NULL,
    notes text,
    error_message text,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    dataset_id bigint,
    file_size_bytes bigint,
    file_sha256 character varying(128),
    ingestion_started_at timestamp(0) without time zone,
    ingestion_finished_at timestamp(0) without time zone,
    ingestion_step character varying(64)
);


ALTER TABLE public.population_rasters OWNER TO postgres;

--
-- TOC entry 282 (class 1259 OID 108254)
-- Name: population_rasters_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.population_rasters_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.population_rasters_id_seq OWNER TO postgres;

--
-- TOC entry 6791 (class 0 OID 0)
-- Dependencies: 282
-- Name: population_rasters_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.population_rasters_id_seq OWNED BY public.population_rasters.id;


--
-- TOC entry 257 (class 1259 OID 107679)
-- Name: roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.roles (
    id bigint NOT NULL,
    name character varying(255) NOT NULL,
    scope character varying(255),
    created_at timestamp(0) with time zone,
    updated_at timestamp(0) with time zone
);


ALTER TABLE public.roles OWNER TO postgres;

--
-- TOC entry 258 (class 1259 OID 107684)
-- Name: roles_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.roles_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.roles_id_seq OWNER TO postgres;

--
-- TOC entry 6792 (class 0 OID 0)
-- Dependencies: 258
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;


--
-- TOC entry 259 (class 1259 OID 107685)
-- Name: sample_results; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sample_results (
    id bigint NOT NULL,
    sampling_event_id bigint NOT NULL,
    parameter_id bigint NOT NULL,
    value double precision,
    unit text,
    depth_m double precision,
    evaluated_class_code text,
    threshold_id bigint,
    pass_fail text,
    evaluated_at timestamp with time zone,
    remarks text
);


ALTER TABLE public.sample_results OWNER TO postgres;

--
-- TOC entry 260 (class 1259 OID 107690)
-- Name: sample_results_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.sample_results_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.sample_results_id_seq OWNER TO postgres;

--
-- TOC entry 6793 (class 0 OID 0)
-- Dependencies: 260
-- Name: sample_results_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.sample_results_id_seq OWNED BY public.sample_results.id;


--
-- TOC entry 261 (class 1259 OID 107691)
-- Name: sampling_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sampling_events (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    lake_id bigint NOT NULL,
    station_id bigint,
    geom_point public.geometry(Point,4326),
    sampled_at timestamp with time zone NOT NULL,
    sampler_name text,
    method text,
    weather text,
    notes text,
    status text DEFAULT 'draft'::text NOT NULL,
    applied_standard_id bigint,
    year integer GENERATED ALWAYS AS ((EXTRACT(year FROM (sampled_at AT TIME ZONE 'Asia/Manila'::text)))::integer) STORED,
    quarter integer GENERATED ALWAYS AS ((EXTRACT(quarter FROM (sampled_at AT TIME ZONE 'Asia/Manila'::text)))::integer) STORED,
    month integer GENERATED ALWAYS AS ((EXTRACT(month FROM (sampled_at AT TIME ZONE 'Asia/Manila'::text)))::integer) STORED,
    day integer GENERATED ALWAYS AS ((EXTRACT(day FROM (sampled_at AT TIME ZONE 'Asia/Manila'::text)))::integer) STORED,
    created_by_user_id bigint,
    updated_by_user_id bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.sampling_events OWNER TO postgres;

--
-- TOC entry 262 (class 1259 OID 107703)
-- Name: sampling_events_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.sampling_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.sampling_events_id_seq OWNER TO postgres;

--
-- TOC entry 6794 (class 0 OID 0)
-- Dependencies: 262
-- Name: sampling_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.sampling_events_id_seq OWNED BY public.sampling_events.id;


--
-- TOC entry 263 (class 1259 OID 107704)
-- Name: sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sessions (
    id character varying(255) NOT NULL,
    user_id bigint,
    ip_address character varying(45),
    user_agent text,
    payload text NOT NULL,
    last_activity integer NOT NULL
);


ALTER TABLE public.sessions OWNER TO postgres;

--
-- TOC entry 264 (class 1259 OID 107709)
-- Name: stations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stations (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    lake_id bigint NOT NULL,
    name text NOT NULL,
    description text,
    geom_point public.geometry(Point,4326),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(0) with time zone,
    updated_at timestamp(0) with time zone
);


ALTER TABLE public.stations OWNER TO postgres;

--
-- TOC entry 265 (class 1259 OID 107715)
-- Name: stations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.stations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.stations_id_seq OWNER TO postgres;

--
-- TOC entry 6795 (class 0 OID 0)
-- Dependencies: 265
-- Name: stations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.stations_id_seq OWNED BY public.stations.id;


--
-- TOC entry 281 (class 1259 OID 108204)
-- Name: tenant_removed_columns_archive; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tenant_removed_columns_archive (
    tenant_id bigint NOT NULL,
    domain text,
    metadata jsonb,
    archived_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.tenant_removed_columns_archive OWNER TO postgres;

--
-- TOC entry 266 (class 1259 OID 107716)
-- Name: tenants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tenants (
    id bigint NOT NULL,
    name character varying(255) NOT NULL,
    type character varying(255),
    phone character varying(255),
    address character varying(255),
    active boolean DEFAULT true NOT NULL,
    created_at timestamp(0) with time zone,
    updated_at timestamp(0) with time zone,
    slug character varying(255),
    contact_email character varying(255),
    deleted_at timestamp without time zone
);


ALTER TABLE public.tenants OWNER TO postgres;

--
-- TOC entry 267 (class 1259 OID 107722)
-- Name: tenants_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tenants_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tenants_id_seq OWNER TO postgres;

--
-- TOC entry 6796 (class 0 OID 0)
-- Dependencies: 267
-- Name: tenants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tenants_id_seq OWNED BY public.tenants.id;


--
-- TOC entry 268 (class 1259 OID 107723)
-- Name: user_tenant_changes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_tenant_changes (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    actor_id bigint,
    old_tenant_id bigint,
    new_tenant_id bigint,
    old_role_id bigint,
    new_role_id bigint,
    reason text,
    created_at timestamp(0) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.user_tenant_changes OWNER TO postgres;

--
-- TOC entry 269 (class 1259 OID 107729)
-- Name: user_tenant_changes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_tenant_changes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_tenant_changes_id_seq OWNER TO postgres;

--
-- TOC entry 6797 (class 0 OID 0)
-- Dependencies: 269
-- Name: user_tenant_changes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_tenant_changes_id_seq OWNED BY public.user_tenant_changes.id;


--
-- TOC entry 270 (class 1259 OID 107730)
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id bigint NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    email_verified_at timestamp(0) without time zone,
    password character varying(255) NOT NULL,
    remember_token character varying(100),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    role_id bigint,
    tenant_id bigint,
    is_active boolean DEFAULT true NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- TOC entry 271 (class 1259 OID 107736)
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- TOC entry 6798 (class 0 OID 0)
-- Dependencies: 271
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- TOC entry 272 (class 1259 OID 107737)
-- Name: water_quality_classes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.water_quality_classes (
    code text NOT NULL,
    name text,
    notes text
);


ALTER TABLE public.water_quality_classes OWNER TO postgres;

--
-- TOC entry 273 (class 1259 OID 107742)
-- Name: watersheds; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.watersheds (
    id bigint NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.watersheds OWNER TO postgres;

--
-- TOC entry 274 (class 1259 OID 107749)
-- Name: watersheds_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.watersheds_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.watersheds_id_seq OWNER TO postgres;

--
-- TOC entry 6799 (class 0 OID 0)
-- Dependencies: 274
-- Name: watersheds_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.watersheds_id_seq OWNED BY public.watersheds.id;


--
-- TOC entry 275 (class 1259 OID 107750)
-- Name: wq_standards; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.wq_standards (
    id bigint NOT NULL,
    code text NOT NULL,
    name text,
    is_current boolean DEFAULT false NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    notes text
);


ALTER TABLE public.wq_standards OWNER TO postgres;

--
-- TOC entry 276 (class 1259 OID 107757)
-- Name: wq_standards_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.wq_standards_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.wq_standards_id_seq OWNER TO postgres;

--
-- TOC entry 6800 (class 0 OID 0)
-- Dependencies: 276
-- Name: wq_standards_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.wq_standards_id_seq OWNED BY public.wq_standards.id;


--
-- TOC entry 6414 (class 2604 OID 108062)
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- TOC entry 6367 (class 2604 OID 107758)
-- Name: failed_jobs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.failed_jobs ALTER COLUMN id SET DEFAULT nextval('public.failed_jobs_id_seq'::regclass);


--
-- TOC entry 6416 (class 2604 OID 108087)
-- Name: feedback id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.feedback ALTER COLUMN id SET DEFAULT nextval('public.feedback_id_seq'::regclass);


--
-- TOC entry 6369 (class 2604 OID 107759)
-- Name: jobs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.jobs ALTER COLUMN id SET DEFAULT nextval('public.jobs_id_seq'::regclass);


--
-- TOC entry 6370 (class 2604 OID 107760)
-- Name: lakes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lakes ALTER COLUMN id SET DEFAULT nextval('public.lakes_id_seq'::regclass);


--
-- TOC entry 6373 (class 2604 OID 107761)
-- Name: layers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.layers ALTER COLUMN id SET DEFAULT nextval('public.layers_id_seq'::regclass);


--
-- TOC entry 6383 (class 2604 OID 107762)
-- Name: migrations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.migrations ALTER COLUMN id SET DEFAULT nextval('public.migrations_id_seq'::regclass);


--
-- TOC entry 6384 (class 2604 OID 107764)
-- Name: parameter_thresholds id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.parameter_thresholds ALTER COLUMN id SET DEFAULT nextval('public.parameter_thresholds_id_seq'::regclass);


--
-- TOC entry 6385 (class 2604 OID 107765)
-- Name: parameters id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.parameters ALTER COLUMN id SET DEFAULT nextval('public.parameters_id_seq'::regclass);


--
-- TOC entry 6387 (class 2604 OID 107766)
-- Name: personal_access_tokens id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.personal_access_tokens ALTER COLUMN id SET DEFAULT nextval('public.personal_access_tokens_id_seq'::regclass);


--
-- TOC entry 6427 (class 2604 OID 108506)
-- Name: pop_counts_2025_1 rid; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pop_counts_2025_1 ALTER COLUMN rid SET DEFAULT nextval('public.pop_counts_2025_1_rid_seq'::regclass);


--
-- TOC entry 6424 (class 2604 OID 108296)
-- Name: pop_dataset_catalog id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pop_dataset_catalog ALTER COLUMN id SET DEFAULT nextval('public.pop_dataset_catalog_id_seq'::regclass);


--
-- TOC entry 6421 (class 2604 OID 108258)
-- Name: population_rasters id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.population_rasters ALTER COLUMN id SET DEFAULT nextval('public.population_rasters_id_seq'::regclass);


--
-- TOC entry 6390 (class 2604 OID 107768)
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);


--
-- TOC entry 6391 (class 2604 OID 107769)
-- Name: sample_results id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sample_results ALTER COLUMN id SET DEFAULT nextval('public.sample_results_id_seq'::regclass);


--
-- TOC entry 6392 (class 2604 OID 107770)
-- Name: sampling_events id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sampling_events ALTER COLUMN id SET DEFAULT nextval('public.sampling_events_id_seq'::regclass);


--
-- TOC entry 6400 (class 2604 OID 107771)
-- Name: stations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stations ALTER COLUMN id SET DEFAULT nextval('public.stations_id_seq'::regclass);


--
-- TOC entry 6402 (class 2604 OID 107772)
-- Name: tenants id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenants ALTER COLUMN id SET DEFAULT nextval('public.tenants_id_seq'::regclass);


--
-- TOC entry 6404 (class 2604 OID 107773)
-- Name: user_tenant_changes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_tenant_changes ALTER COLUMN id SET DEFAULT nextval('public.user_tenant_changes_id_seq'::regclass);


--
-- TOC entry 6406 (class 2604 OID 107774)
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- TOC entry 6408 (class 2604 OID 107775)
-- Name: watersheds id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.watersheds ALTER COLUMN id SET DEFAULT nextval('public.watersheds_id_seq'::regclass);


--
-- TOC entry 6411 (class 2604 OID 107776)
-- Name: wq_standards id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wq_standards ALTER COLUMN id SET DEFAULT nextval('public.wq_standards_id_seq'::regclass);


--
-- TOC entry 6561 (class 2606 OID 108067)
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 6448 (class 2606 OID 107784)
-- Name: cache_locks cache_locks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cache_locks
    ADD CONSTRAINT cache_locks_pkey PRIMARY KEY (key);


--
-- TOC entry 6446 (class 2606 OID 107786)
-- Name: cache cache_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cache
    ADD CONSTRAINT cache_pkey PRIMARY KEY (key);


--
-- TOC entry 6430 (class 2606 OID 107787)
-- Name: layers chk_layers_source_type; Type: CHECK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE public.layers
    ADD CONSTRAINT chk_layers_source_type CHECK ((source_type = ANY (ARRAY['geojson'::text, 'json'::text, 'shp'::text, 'kml'::text, 'gpkg'::text, 'wkt'::text]))) NOT VALID;


--
-- TOC entry 6450 (class 2606 OID 107790)
-- Name: email_otps email_otps_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_otps
    ADD CONSTRAINT email_otps_pkey PRIMARY KEY (id);


--
-- TOC entry 6433 (class 2606 OID 108549)
-- Name: pop_counts_2025_1 enforce_max_extent_rast; Type: CHECK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE public.pop_counts_2025_1
    ADD CONSTRAINT enforce_max_extent_rast CHECK ((public.st_envelope(rast) OPERATOR(public.@) '0103000020E61000000100000005000000B8EA372E333B5D401CCEA66A55551240B8EA372E333B5D402D2F380400203540830FCAE9EEA65F402D2F380400203540830FCAE9EEA65F401CCEA66A55551240B8EA372E333B5D401CCEA66A55551240'::public.geometry)) NOT VALID;


--
-- TOC entry 6452 (class 2606 OID 107792)
-- Name: failed_jobs failed_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.failed_jobs
    ADD CONSTRAINT failed_jobs_pkey PRIMARY KEY (id);


--
-- TOC entry 6454 (class 2606 OID 107794)
-- Name: failed_jobs failed_jobs_uuid_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.failed_jobs
    ADD CONSTRAINT failed_jobs_uuid_unique UNIQUE (uuid);


--
-- TOC entry 6568 (class 2606 OID 108094)
-- Name: feedback feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_pkey PRIMARY KEY (id);


--
-- TOC entry 6456 (class 2606 OID 107796)
-- Name: job_batches job_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_batches
    ADD CONSTRAINT job_batches_pkey PRIMARY KEY (id);


--
-- TOC entry 6458 (class 2606 OID 107798)
-- Name: jobs jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_pkey PRIMARY KEY (id);


--
-- TOC entry 6462 (class 2606 OID 107800)
-- Name: lakes lakes_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lakes
    ADD CONSTRAINT lakes_name_key UNIQUE (name);


--
-- TOC entry 6464 (class 2606 OID 107802)
-- Name: lakes lakes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lakes
    ADD CONSTRAINT lakes_pkey PRIMARY KEY (id);


--
-- TOC entry 6470 (class 2606 OID 107804)
-- Name: layers layers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.layers
    ADD CONSTRAINT layers_pkey PRIMARY KEY (id);


--
-- TOC entry 6473 (class 2606 OID 107806)
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- TOC entry 6476 (class 2606 OID 107812)
-- Name: parameter_thresholds parameter_thresholds_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.parameter_thresholds
    ADD CONSTRAINT parameter_thresholds_pkey PRIMARY KEY (id);


--
-- TOC entry 6481 (class 2606 OID 107814)
-- Name: parameters parameters_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.parameters
    ADD CONSTRAINT parameters_code_key UNIQUE (code);


--
-- TOC entry 6483 (class 2606 OID 107816)
-- Name: parameters parameters_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.parameters
    ADD CONSTRAINT parameters_pkey PRIMARY KEY (id);


--
-- TOC entry 6485 (class 2606 OID 107818)
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (email);


--
-- TOC entry 6488 (class 2606 OID 107820)
-- Name: personal_access_tokens personal_access_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.personal_access_tokens
    ADD CONSTRAINT personal_access_tokens_pkey PRIMARY KEY (id);


--
-- TOC entry 6490 (class 2606 OID 107822)
-- Name: personal_access_tokens personal_access_tokens_token_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.personal_access_tokens
    ADD CONSTRAINT personal_access_tokens_token_unique UNIQUE (token);


--
-- TOC entry 6582 (class 2606 OID 108510)
-- Name: pop_counts_2025_1 pop_counts_2025_1_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pop_counts_2025_1
    ADD CONSTRAINT pop_counts_2025_1_pkey PRIMARY KEY (rid);


--
-- TOC entry 6578 (class 2606 OID 108302)
-- Name: pop_dataset_catalog pop_dataset_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pop_dataset_catalog
    ADD CONSTRAINT pop_dataset_catalog_pkey PRIMARY KEY (id);


--
-- TOC entry 6580 (class 2606 OID 108304)
-- Name: pop_dataset_catalog pop_dataset_catalog_table_name_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pop_dataset_catalog
    ADD CONSTRAINT pop_dataset_catalog_table_name_unique UNIQUE (table_name);


--
-- TOC entry 6493 (class 2606 OID 107828)
-- Name: pop_estimate_cache pop_estimate_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pop_estimate_cache
    ADD CONSTRAINT pop_estimate_cache_pkey PRIMARY KEY (lake_id, year, radius_km, method);


--
-- TOC entry 6573 (class 2606 OID 108264)
-- Name: population_rasters population_rasters_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.population_rasters
    ADD CONSTRAINT population_rasters_pkey PRIMARY KEY (id);


--
-- TOC entry 6495 (class 2606 OID 107830)
-- Name: roles roles_name_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_name_unique UNIQUE (name);


--
-- TOC entry 6497 (class 2606 OID 107832)
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- TOC entry 6503 (class 2606 OID 107834)
-- Name: sample_results sample_results_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sample_results
    ADD CONSTRAINT sample_results_pkey PRIMARY KEY (id);


--
-- TOC entry 6514 (class 2606 OID 107836)
-- Name: sampling_events sampling_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sampling_events
    ADD CONSTRAINT sampling_events_pkey PRIMARY KEY (id);


--
-- TOC entry 6517 (class 2606 OID 107838)
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- TOC entry 6523 (class 2606 OID 107840)
-- Name: stations stations_organization_id_lake_id_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stations
    ADD CONSTRAINT stations_organization_id_lake_id_name_key UNIQUE (organization_id, lake_id, name);


--
-- TOC entry 6525 (class 2606 OID 107842)
-- Name: stations stations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stations
    ADD CONSTRAINT stations_pkey PRIMARY KEY (id);


--
-- TOC entry 6571 (class 2606 OID 108211)
-- Name: tenant_removed_columns_archive tenant_removed_columns_archive_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenant_removed_columns_archive
    ADD CONSTRAINT tenant_removed_columns_archive_pkey PRIMARY KEY (tenant_id);


--
-- TOC entry 6527 (class 2606 OID 107846)
-- Name: tenants tenants_name_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_name_unique UNIQUE (name);


--
-- TOC entry 6529 (class 2606 OID 107848)
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- TOC entry 6531 (class 2606 OID 107850)
-- Name: tenants tenants_slug_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_slug_unique UNIQUE (slug);


--
-- TOC entry 6533 (class 2606 OID 107852)
-- Name: user_tenant_changes user_tenant_changes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_tenant_changes
    ADD CONSTRAINT user_tenant_changes_pkey PRIMARY KEY (id);


--
-- TOC entry 6539 (class 2606 OID 107854)
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- TOC entry 6542 (class 2606 OID 107856)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 6546 (class 2606 OID 107858)
-- Name: water_quality_classes water_quality_classes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.water_quality_classes
    ADD CONSTRAINT water_quality_classes_pkey PRIMARY KEY (code);


--
-- TOC entry 6548 (class 2606 OID 107860)
-- Name: watersheds watersheds_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.watersheds
    ADD CONSTRAINT watersheds_name_key UNIQUE (name);


--
-- TOC entry 6550 (class 2606 OID 107862)
-- Name: watersheds watersheds_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.watersheds
    ADD CONSTRAINT watersheds_pkey PRIMARY KEY (id);


--
-- TOC entry 6553 (class 2606 OID 107864)
-- Name: wq_standards wq_standards_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wq_standards
    ADD CONSTRAINT wq_standards_code_key UNIQUE (code);


--
-- TOC entry 6555 (class 2606 OID 107866)
-- Name: wq_standards wq_standards_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wq_standards
    ADD CONSTRAINT wq_standards_pkey PRIMARY KEY (id);


--
-- TOC entry 6556 (class 1259 OID 108081)
-- Name: audit_logs_action_event_at_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX audit_logs_action_event_at_index ON public.audit_logs USING btree (action, event_at);


--
-- TOC entry 6557 (class 1259 OID 108080)
-- Name: audit_logs_actor_id_event_at_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX audit_logs_actor_id_event_at_index ON public.audit_logs USING btree (actor_id, event_at);


--
-- TOC entry 6558 (class 1259 OID 108082)
-- Name: audit_logs_hash_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX audit_logs_hash_index ON public.audit_logs USING btree (hash);


--
-- TOC entry 6559 (class 1259 OID 108079)
-- Name: audit_logs_model_type_model_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX audit_logs_model_type_model_id_index ON public.audit_logs USING btree (model_type, model_id);


--
-- TOC entry 6562 (class 1259 OID 108078)
-- Name: audit_logs_tenant_id_event_at_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX audit_logs_tenant_id_event_at_index ON public.audit_logs USING btree (tenant_id, event_at);


--
-- TOC entry 6563 (class 1259 OID 108106)
-- Name: feedback_created_at_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX feedback_created_at_index ON public.feedback USING btree (created_at);


--
-- TOC entry 6564 (class 1259 OID 108109)
-- Name: feedback_guest_email_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX feedback_guest_email_index ON public.feedback USING btree (guest_email);


--
-- TOC entry 6565 (class 1259 OID 108107)
-- Name: feedback_is_guest_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX feedback_is_guest_index ON public.feedback USING btree (is_guest);


--
-- TOC entry 6566 (class 1259 OID 108108)
-- Name: feedback_is_guest_status_created_at_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX feedback_is_guest_status_created_at_index ON public.feedback USING btree (is_guest, status, created_at);


--
-- TOC entry 6569 (class 1259 OID 108105)
-- Name: feedback_status_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX feedback_status_index ON public.feedback USING btree (status);


--
-- TOC entry 6460 (class 1259 OID 107867)
-- Name: idx_lakes_class; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_lakes_class ON public.lakes USING btree (class_code);


--
-- TOC entry 6465 (class 1259 OID 107868)
-- Name: idx_layers_body; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_layers_body ON public.layers USING btree (body_type, body_id);


--
-- TOC entry 6466 (class 1259 OID 107869)
-- Name: idx_layers_geom; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_layers_geom ON public.layers USING gist (geom);


--
-- TOC entry 6467 (class 1259 OID 107870)
-- Name: idx_layers_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_layers_type ON public.layers USING btree (type);


--
-- TOC entry 6468 (class 1259 OID 107871)
-- Name: idx_layers_visibility; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_layers_visibility ON public.layers USING btree (visibility);


--
-- TOC entry 6478 (class 1259 OID 107872)
-- Name: idx_parameters_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_parameters_category ON public.parameters USING btree (category);


--
-- TOC entry 6479 (class 1259 OID 107873)
-- Name: idx_parameters_group; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_parameters_group ON public.parameters USING btree ("group");


--
-- TOC entry 6474 (class 1259 OID 107874)
-- Name: idx_pt_param_class; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pt_param_class ON public.parameter_thresholds USING btree (parameter_id, class_code);


--
-- TOC entry 6504 (class 1259 OID 107875)
-- Name: idx_se_applied_standard; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_se_applied_standard ON public.sampling_events USING btree (applied_standard_id);


--
-- TOC entry 6505 (class 1259 OID 107876)
-- Name: idx_se_created_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_se_created_by ON public.sampling_events USING btree (created_by_user_id);


--
-- TOC entry 6506 (class 1259 OID 107877)
-- Name: idx_se_geom; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_se_geom ON public.sampling_events USING gist (geom_point);


--
-- TOC entry 6507 (class 1259 OID 107878)
-- Name: idx_se_lake_status_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_se_lake_status_date ON public.sampling_events USING btree (lake_id, status, sampled_at DESC);


--
-- TOC entry 6508 (class 1259 OID 107879)
-- Name: idx_se_org_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_se_org_date ON public.sampling_events USING btree (organization_id, sampled_at DESC);


--
-- TOC entry 6509 (class 1259 OID 107880)
-- Name: idx_se_station_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_se_station_date ON public.sampling_events USING btree (station_id, sampled_at DESC);


--
-- TOC entry 6510 (class 1259 OID 107881)
-- Name: idx_se_year; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_se_year ON public.sampling_events USING btree (year);


--
-- TOC entry 6511 (class 1259 OID 107882)
-- Name: idx_se_year_m; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_se_year_m ON public.sampling_events USING btree (year, month);


--
-- TOC entry 6512 (class 1259 OID 107883)
-- Name: idx_se_year_q; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_se_year_q ON public.sampling_events USING btree (year, quarter);


--
-- TOC entry 6498 (class 1259 OID 107884)
-- Name: idx_sr_eval_class; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sr_eval_class ON public.sample_results USING btree (evaluated_class_code);


--
-- TOC entry 6499 (class 1259 OID 107885)
-- Name: idx_sr_event; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sr_event ON public.sample_results USING btree (sampling_event_id);


--
-- TOC entry 6500 (class 1259 OID 107886)
-- Name: idx_sr_param_event; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sr_param_event ON public.sample_results USING btree (parameter_id, sampling_event_id);


--
-- TOC entry 6501 (class 1259 OID 107887)
-- Name: idx_sr_param_pass; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sr_param_pass ON public.sample_results USING btree (parameter_id, pass_fail);


--
-- TOC entry 6519 (class 1259 OID 107888)
-- Name: idx_stations_geom; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stations_geom ON public.stations USING gist (geom_point);


--
-- TOC entry 6520 (class 1259 OID 107889)
-- Name: idx_stations_lake; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stations_lake ON public.stations USING btree (lake_id);


--
-- TOC entry 6521 (class 1259 OID 107890)
-- Name: idx_stations_org_lake; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stations_org_lake ON public.stations USING btree (organization_id, lake_id);


--
-- TOC entry 6535 (class 1259 OID 107891)
-- Name: idx_users_is_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_is_active ON public.users USING btree (is_active);


--
-- TOC entry 6536 (class 1259 OID 107892)
-- Name: idx_users_role_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_role_id ON public.users USING btree (role_id);


--
-- TOC entry 6537 (class 1259 OID 107893)
-- Name: idx_users_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_tenant_id ON public.users USING btree (tenant_id);


--
-- TOC entry 6551 (class 1259 OID 107894)
-- Name: idx_wqs_is_current; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wqs_is_current ON public.wq_standards USING btree (is_current, priority DESC);


--
-- TOC entry 6459 (class 1259 OID 107895)
-- Name: jobs_queue_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX jobs_queue_index ON public.jobs USING btree (queue);


--
-- TOC entry 6486 (class 1259 OID 107896)
-- Name: personal_access_tokens_expires_at_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX personal_access_tokens_expires_at_index ON public.personal_access_tokens USING btree (expires_at);


--
-- TOC entry 6491 (class 1259 OID 107897)
-- Name: personal_access_tokens_tokenable_type_tokenable_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX personal_access_tokens_tokenable_type_tokenable_id_index ON public.personal_access_tokens USING btree (tokenable_type, tokenable_id);


--
-- TOC entry 6583 (class 1259 OID 108538)
-- Name: pop_counts_2025_1_st_convexhull_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX pop_counts_2025_1_st_convexhull_idx ON public.pop_counts_2025_1 USING gist (public.st_convexhull(rast));


--
-- TOC entry 6574 (class 1259 OID 108271)
-- Name: population_rasters_status_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX population_rasters_status_index ON public.population_rasters USING btree (status);


--
-- TOC entry 6575 (class 1259 OID 108272)
-- Name: population_rasters_status_ingestion_step_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX population_rasters_status_ingestion_step_index ON public.population_rasters USING btree (status, ingestion_step);


--
-- TOC entry 6576 (class 1259 OID 108265)
-- Name: population_rasters_year_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX population_rasters_year_index ON public.population_rasters USING btree (year);


--
-- TOC entry 6515 (class 1259 OID 107898)
-- Name: sessions_last_activity_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX sessions_last_activity_index ON public.sessions USING btree (last_activity);


--
-- TOC entry 6518 (class 1259 OID 107899)
-- Name: sessions_user_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX sessions_user_id_index ON public.sessions USING btree (user_id);


--
-- TOC entry 6471 (class 1259 OID 107900)
-- Name: uq_layers_active_per_body; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uq_layers_active_per_body ON public.layers USING btree (body_type, body_id) WHERE is_active;


--
-- TOC entry 6477 (class 1259 OID 107902)
-- Name: uq_pt_param_class_std; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uq_pt_param_class_std ON public.parameter_thresholds USING btree (parameter_id, class_code, standard_id) WHERE (standard_id IS NOT NULL);


--
-- TOC entry 6534 (class 1259 OID 107903)
-- Name: user_tenant_changes_user_id_created_at_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX user_tenant_changes_user_id_created_at_index ON public.user_tenant_changes USING btree (user_id, created_at);


--
-- TOC entry 6540 (class 1259 OID 107904)
-- Name: users_is_active_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX users_is_active_idx ON public.users USING btree (is_active);


--
-- TOC entry 6543 (class 1259 OID 107905)
-- Name: users_role_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX users_role_id_idx ON public.users USING btree (role_id);


--
-- TOC entry 6544 (class 1259 OID 107906)
-- Name: users_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX users_tenant_id_idx ON public.users USING btree (tenant_id);


--
-- TOC entry 6617 (class 2620 OID 107907)
-- Name: sampling_events sampling_events_set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER sampling_events_set_updated_at BEFORE UPDATE ON public.sampling_events FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();


--
-- TOC entry 6618 (class 2620 OID 107908)
-- Name: sampling_events se_inherit_station_geom; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER se_inherit_station_geom BEFORE INSERT OR UPDATE ON public.sampling_events FOR EACH ROW EXECUTE FUNCTION public.trg_se_inherit_station_geom();


--
-- TOC entry 6619 (class 2620 OID 107909)
-- Name: users trg_enforce_user_role_scope; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_enforce_user_role_scope BEFORE INSERT OR UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.enforce_user_role_scope();


--
-- TOC entry 6616 (class 2620 OID 107910)
-- Name: sample_results trg_evaluate_pass_fail; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_evaluate_pass_fail BEFORE INSERT OR UPDATE ON public.sample_results FOR EACH ROW EXECUTE FUNCTION public.evaluate_pass_fail();


--
-- TOC entry 6615 (class 2620 OID 107911)
-- Name: layers trg_layers_on_activate; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_layers_on_activate AFTER INSERT OR UPDATE OF is_active, geom ON public.layers FOR EACH ROW EXECUTE FUNCTION public.layers_on_activate();


--
-- TOC entry 6610 (class 2606 OID 108068)
-- Name: audit_logs audit_logs_actor_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_actor_id_foreign FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 6611 (class 2606 OID 108073)
-- Name: audit_logs audit_logs_tenant_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_tenant_id_foreign FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL;


--
-- TOC entry 6612 (class 2606 OID 108100)
-- Name: feedback feedback_tenant_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_tenant_id_foreign FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL;


--
-- TOC entry 6613 (class 2606 OID 108095)
-- Name: feedback feedback_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 6584 (class 2606 OID 107912)
-- Name: lakes fk_lakes_class_code; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lakes
    ADD CONSTRAINT fk_lakes_class_code FOREIGN KEY (class_code) REFERENCES public.water_quality_classes(code) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 6585 (class 2606 OID 107917)
-- Name: lakes fk_lakes_watershed; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lakes
    ADD CONSTRAINT fk_lakes_watershed FOREIGN KEY (watershed_id) REFERENCES public.watersheds(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 6587 (class 2606 OID 107922)
-- Name: parameter_thresholds fk_parameter_thresholds_standard; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.parameter_thresholds
    ADD CONSTRAINT fk_parameter_thresholds_standard FOREIGN KEY (standard_id) REFERENCES public.wq_standards(id) ON DELETE RESTRICT;


--
-- TOC entry 6594 (class 2606 OID 107927)
-- Name: sampling_events fk_sampling_events_applied_standard; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sampling_events
    ADD CONSTRAINT fk_sampling_events_applied_standard FOREIGN KEY (applied_standard_id) REFERENCES public.wq_standards(id) ON DELETE SET NULL;


--
-- TOC entry 6586 (class 2606 OID 107932)
-- Name: layers layers_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.layers
    ADD CONSTRAINT layers_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 6588 (class 2606 OID 107942)
-- Name: parameter_thresholds parameter_thresholds_class_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.parameter_thresholds
    ADD CONSTRAINT parameter_thresholds_class_code_fkey FOREIGN KEY (class_code) REFERENCES public.water_quality_classes(code) ON DELETE RESTRICT;


--
-- TOC entry 6589 (class 2606 OID 107947)
-- Name: parameter_thresholds parameter_thresholds_parameter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.parameter_thresholds
    ADD CONSTRAINT parameter_thresholds_parameter_id_fkey FOREIGN KEY (parameter_id) REFERENCES public.parameters(id) ON DELETE CASCADE;


--
-- TOC entry 6614 (class 2606 OID 108266)
-- Name: population_rasters population_rasters_uploaded_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.population_rasters
    ADD CONSTRAINT population_rasters_uploaded_by_foreign FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 6590 (class 2606 OID 107952)
-- Name: sample_results sample_results_evaluated_class_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sample_results
    ADD CONSTRAINT sample_results_evaluated_class_code_fkey FOREIGN KEY (evaluated_class_code) REFERENCES public.water_quality_classes(code) ON DELETE SET NULL;


--
-- TOC entry 6591 (class 2606 OID 107957)
-- Name: sample_results sample_results_parameter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sample_results
    ADD CONSTRAINT sample_results_parameter_id_fkey FOREIGN KEY (parameter_id) REFERENCES public.parameters(id) ON DELETE RESTRICT;


--
-- TOC entry 6592 (class 2606 OID 107962)
-- Name: sample_results sample_results_sampling_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sample_results
    ADD CONSTRAINT sample_results_sampling_event_id_fkey FOREIGN KEY (sampling_event_id) REFERENCES public.sampling_events(id) ON DELETE CASCADE;


--
-- TOC entry 6593 (class 2606 OID 107967)
-- Name: sample_results sample_results_threshold_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sample_results
    ADD CONSTRAINT sample_results_threshold_id_fkey FOREIGN KEY (threshold_id) REFERENCES public.parameter_thresholds(id) ON DELETE SET NULL;


--
-- TOC entry 6595 (class 2606 OID 107972)
-- Name: sampling_events sampling_events_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sampling_events
    ADD CONSTRAINT sampling_events_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 6596 (class 2606 OID 107977)
-- Name: sampling_events sampling_events_lake_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sampling_events
    ADD CONSTRAINT sampling_events_lake_id_fkey FOREIGN KEY (lake_id) REFERENCES public.lakes(id) ON DELETE CASCADE;


--
-- TOC entry 6597 (class 2606 OID 107982)
-- Name: sampling_events sampling_events_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sampling_events
    ADD CONSTRAINT sampling_events_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- TOC entry 6598 (class 2606 OID 107987)
-- Name: sampling_events sampling_events_station_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sampling_events
    ADD CONSTRAINT sampling_events_station_id_fkey FOREIGN KEY (station_id) REFERENCES public.stations(id) ON DELETE SET NULL;


--
-- TOC entry 6599 (class 2606 OID 107992)
-- Name: sampling_events sampling_events_updated_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sampling_events
    ADD CONSTRAINT sampling_events_updated_by_user_id_fkey FOREIGN KEY (updated_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 6600 (class 2606 OID 107997)
-- Name: stations stations_lake_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stations
    ADD CONSTRAINT stations_lake_id_fkey FOREIGN KEY (lake_id) REFERENCES public.lakes(id) ON DELETE CASCADE;


--
-- TOC entry 6601 (class 2606 OID 108002)
-- Name: stations stations_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stations
    ADD CONSTRAINT stations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- TOC entry 6602 (class 2606 OID 108007)
-- Name: user_tenant_changes user_tenant_changes_actor_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_tenant_changes
    ADD CONSTRAINT user_tenant_changes_actor_id_foreign FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 6603 (class 2606 OID 108012)
-- Name: user_tenant_changes user_tenant_changes_new_role_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_tenant_changes
    ADD CONSTRAINT user_tenant_changes_new_role_id_foreign FOREIGN KEY (new_role_id) REFERENCES public.roles(id) ON DELETE SET NULL;


--
-- TOC entry 6604 (class 2606 OID 108017)
-- Name: user_tenant_changes user_tenant_changes_new_tenant_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_tenant_changes
    ADD CONSTRAINT user_tenant_changes_new_tenant_id_foreign FOREIGN KEY (new_tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL;


--
-- TOC entry 6605 (class 2606 OID 108022)
-- Name: user_tenant_changes user_tenant_changes_old_role_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_tenant_changes
    ADD CONSTRAINT user_tenant_changes_old_role_id_foreign FOREIGN KEY (old_role_id) REFERENCES public.roles(id) ON DELETE SET NULL;


--
-- TOC entry 6606 (class 2606 OID 108027)
-- Name: user_tenant_changes user_tenant_changes_old_tenant_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_tenant_changes
    ADD CONSTRAINT user_tenant_changes_old_tenant_id_foreign FOREIGN KEY (old_tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL;


--
-- TOC entry 6607 (class 2606 OID 108032)
-- Name: user_tenant_changes user_tenant_changes_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_tenant_changes
    ADD CONSTRAINT user_tenant_changes_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 6608 (class 2606 OID 108037)
-- Name: users users_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id);


--
-- TOC entry 6609 (class 2606 OID 108042)
-- Name: users users_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL;


-- Completed on 2025-10-06 19:11:03

--
-- PostgreSQL database dump complete
--

\unrestrict OeXJEna3j13WLjj36GQcptcaAcIqMtQfuWYpSea7sCednP2q8sfRixb0a0UNCtI

