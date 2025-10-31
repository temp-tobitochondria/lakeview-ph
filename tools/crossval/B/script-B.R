args <- commandArgs(trailingOnly = TRUE)
out_path <- if (length(args) >= 1) args[[1]] else 'tools/crossval/B/out.json'
monthly_csv <- if (length(args) >= 2) args[[2]] else ''

# ---------------- Data (Test B) ----------------
LakeA_single <- c(
  1, 2, 2, 2, 2, 2, 1, 2, 1, 2, 1, 1, 1, 2, 2, 4, 3, 6, 2, 4, 4, 7, 4, 4, 4, 2, 3, 3, 3, 3, 2, 4, 4, 6, 6, 4, 2, 2, 2, 2, 2, 2, 2, 3, 3, 4, 4
)
mu0 <- 7

LakeA_range <- c(
  8.2, 8.1, 8.4, 8.3, 8.5, 8.4, 8.5, 8.4, 8.4, 8.3, 8.7, 8.2, 8.1, 8.3, 8.1, 9.4, 8.7, 9.3, 8.6, 9.1, 7.7, 9.4, 9.2, 8.9, 9.0, 8.8, 9.1, 8.8, 7.8, 7.6, 7.8, 8.9, 8.7, 7.8, 7.7, 8.0, 7.9, 8.1, 8.7, 8.6, 7.6, 7.8, 7.3, 7.4, 7.6, 9.4, 7.8
)
lower <- 6.5; upper <- 9

LakeA <- LakeA_single
LakeB <- c(3.2, 3.5, 3.8, 4.1, 3.9, 3.7, 4.5, 4.8, 3.6, 3.3, 3.1, 4.0)

# Build monthly points (Laguna de Bay 2024)
monthly <- data.frame(date=as.POSIXct(character()), value=numeric())
if (nzchar(monthly_csv) && file.exists(monthly_csv)) {
  df <- read.csv(monthly_csv, stringsAsFactors = FALSE)
  if (all(c('date','value') %in% names(df))) {
    monthly <- data.frame(date = as.POSIXct(df$date), value = as.numeric(df$value))
  }
}

# Helper functions copied from test-A.R
month_key <- function(dt) format(dt, "%Y-%m")
median_na <- function(v) median(v, na.rm = TRUE)
monthly_medians <- function(dat) {
  dat <- dat[!is.na(dat$value) & !is.na(dat$date), ]
  if (nrow(dat) == 0) return(data.frame(date = as.POSIXct(character()), value = numeric()))
  dat$ym <- month_key(dat$date)
  ag <- aggregate(value ~ ym, data = dat, FUN = median_na)
  parse_ym <- function(ym) as.POSIXct(sprintf('%s-15', ym))
  data.frame(date = parse_ym(ag$ym), value = ag$value)
}
season_of <- function(dt) { m <- as.integer(format(dt, "%m")); if (m>=6 && m<=11) 'wet' else 'dry' }
season_year_of <- function(dt) { y<-as.integer(format(dt, "%Y")); m<-as.integer(format(dt, "%m")); if (m==12) as.integer(y+1) else y }
build_season_series <- function(monthly) {
  if (nrow(monthly) == 0) return(list(wet=data.frame(year=integer(),value=numeric()), dry=data.frame(year=integer(),value=numeric())))
  monthly$season <- vapply(monthly$date, season_of, character(1))
  monthly$sy <- vapply(monthly$date, season_year_of, integer(1))
  ag <- aggregate(value ~ season + sy, data = monthly, FUN = median_na)
  wet <- ag[ag$season=='wet', c('sy','value')]; dry <- ag[ag$season=='dry', c('sy','value')]
  names(wet) <- c('year','value'); names(dry) <- c('year','value')
  wet <- wet[order(wet$year),]; dry <- dry[order(dry$year),]
  list(wet=wet, dry=dry)
}
mk_single <- function(vals){
  n <- nrow(vals)
  if (is.null(n) || n < 2) return(list(n=ifelse(is.null(n),0,n), S=0, Var=0))
  v <- vals$value
  S <- 0
  for (i in 1:(n-1)) {
    for (j in (i+1):n) {
      d <- v[j] - v[i]
      if (d > 0) S <- S + 1 else if (d < 0) S <- S - 1
    }
  }
  srt <- sort(v)
  tieSum <- 0
  i <- 1
  while (i <= length(srt)) {
    j <- i + 1
    while (j <= length(srt) && abs(srt[j] - srt[i]) < 1e-12) j <- j + 1
    t <- j - i
    if (t > 1) tieSum <- tieSum + t*(t-1)*(2*t+5)
    i <- j
  }
  Var <- (n*(n-1)*(2*n+5) - tieSum) / 18
  if (Var < 0) Var <- 0
  list(n=n, S=S, Var=Var)
}
seasonal_mk <- function(series){
  parts <- list()
  if (nrow(series$wet) >= 2) parts[[length(parts)+1]] <- mk_single(series$wet)
  if (nrow(series$dry) >= 2) parts[[length(parts)+1]] <- mk_single(series$dry)
  S <- sum(vapply(parts, function(p) p$S, numeric(1)))
  Var <- sum(vapply(parts, function(p) p$Var, numeric(1)))
  Z <- 0
  if (Var > 0) {
    if (S > 0) Z <- (S - 1)/sqrt(Var) else if (S < 0) Z <- (S + 1)/sqrt(Var) else Z <- 0
  }
  pTwo <- if (Var > 0) 2*(1 - pnorm(abs(Z))) else 1
  list(S=S, Var=Var, Z=Z, p_value=max(0,min(1,pTwo)), nWet=nrow(series$wet), nDry=nrow(series$dry))
}
sens_slope_combined <- function(series){
  slopes <- c()
  add_slopes <- function(df){
    n <- nrow(df)
    if (n < 2) return()
    for (i in 1:(n-1)) {
      for (j in (i+1):n) {
        dy <- df$value[j] - df$value[i]
        dt <- df$year[j] - df$year[i]
        if (dt != 0) slopes <<- c(slopes, dy/dt)
      }
    }
  }
  if (nrow(series$wet) > 0) add_slopes(series$wet)
  if (nrow(series$dry) > 0) add_slopes(series$dry)
  if (length(slopes) == 0) return(list(slope=0, intercept=NaN))
  const <- sort(slopes)
  srt <- const
  n <- length(srt)
  slope <- if (n %% 2 == 1) srt[(n+1)/2] else mean(srt[(n/2):(n/2+1)])
  pts <- rbind(series$wet, series$dry)
  regr <- pts$value - slope * pts$year
  regr <- sort(regr)
  m <- length(regr)
  intercept <- if (m == 0) NaN else if (m %% 2 == 1) regr[(m+1)/2] else mean(regr[(m/2):(m/2+1)])
  list(slope=slope, intercept=intercept)
}

res <- list()

res$`Shapiro-Wilk` <- as.numeric(shapiro.test(LakeA_single)$p.value)

levene_bf <- function(x, y) {
  g <- c(rep(1, length(x)), rep(2, length(y)))
  vals <- c(x, y)
  med1 <- median(x); med2 <- median(y)
  z <- c(abs(x - med1), abs(y - med2))
  df1 <- 1
  df2 <- length(vals) - 2
  m1 <- mean(z[g==1]); m2 <- mean(z[g==2]); m <- mean(z)
  ssb <- length(x) * (m1 - m)^2 + length(y) * (m2 - m)^2
  ssw <- sum((z[g==1] - m1)^2) + sum((z[g==2] - m2)^2)
  F <- (ssb/df1) / (ssw/df2)
  p <- 1 - pf(F, df1, df2)
  list(F=F, df1=df1, df2=df2, p=p)
}
res$`Levene (Brown-Forsythe)` <- as.numeric(levene_bf(LakeA, LakeB)$p)

monthly_med <- monthly_medians(monthly)
series <- build_season_series(monthly_med)
mk <- seasonal_mk(series)
res$`Seasonal Mann-Kendall` <- as.numeric(mk$p_value)
res$`Sen's Slope` <- NA_real_

res$`One Sample t-test (Less)` <- as.numeric(t.test(LakeA_single, mu=mu0, alternative='less')$p.value)

wd <- LakeA_single - mu0
w_nonzero <- wd[abs(wd) > 1e-12]
if (length(w_nonzero) == 0) res$`Wilcoxon Signed-Rank (Less)` <- 1.0 else res$`Wilcoxon Signed-Rank (Less)` <- as.numeric(wilcox.test(w_nonzero, mu=0, alternative='less', exact=FALSE, correct=TRUE)$p.value)

pos <- sum(LakeA_single > mu0); neg <- sum(LakeA_single < mu0); n_eff <- pos + neg
res$`Sign Test (Less)` <- as.numeric(pbinom(pos, n_eff, 0.5))

nx <- length(LakeA_range); mx <- mean(LakeA_range); sx <- sd(LakeA_range); se <- sx/sqrt(nx); df <- nx - 1
t1 <- (mx - lower)/se; t2 <- (upper - mx)/se
p1 <- 1 - pt(t1, df); p2 <- 1 - pt(t2, df)
res$`Equivalence TOST t` <- as.numeric(max(p1, p2))

dL <- LakeA_range - lower; dU <- LakeA_range - upper
dL <- dL[abs(dL) > 1e-12]; dU <- dU[abs(dU) > 1e-12]
if (length(dL) == 0 || length(dU) == 0) res$`Equivalence TOST Wilcoxon` <- 1.0 else {
  pL <- as.numeric(wilcox.test(dL, mu=0, alternative='greater', exact=FALSE, correct=TRUE)$p.value)
  pU <- as.numeric(wilcox.test(dU, mu=0, alternative='less',    exact=FALSE, correct=TRUE)$p.value)
  res$`Equivalence TOST Wilcoxon` <- max(pL, pU)
}

res$`Student t-test` <- as.numeric(t.test(LakeA, LakeB, var.equal=TRUE)$p.value)
res$`Welch t-test`   <- as.numeric(t.test(LakeA, LakeB, var.equal=FALSE)$p.value)
res$`Mann-Whitney U` <- as.numeric(wilcox.test(LakeA, LakeB, paired=FALSE, exact=FALSE, correct=TRUE)$p.value)

all_vals <- c(LakeA, LakeB)
med <- median(all_vals)
c11 <- sum(LakeA <= med); c12 <- sum(LakeA > med)
c21 <- sum(LakeB <= med); c22 <- sum(LakeB > med)
tbl <- matrix(c(c11,c12,c21,c22), nrow=2, byrow=TRUE)
res$`Mood's Median` <- as.numeric(chisq.test(tbl, correct=FALSE)$p.value)

dir.create(dirname(out_path), recursive = TRUE, showWarnings = FALSE)
vals <- unlist(res)
parts <- character(length(vals))
for (i in seq_along(vals)) {
  k <- names(vals)[i]
  v <- vals[i]
  if (is.na(v)) parts[i] <- sprintf('"%s": null', k) else parts[i] <- sprintf('"%s": %.15g', k, v)
}
json <- paste0('{', paste(parts, collapse=', '), '}')
writeLines(json, out_path)
cat('Wrote', out_path, '\n')
