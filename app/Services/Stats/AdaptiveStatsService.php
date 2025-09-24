<?php

namespace App\Services\Stats;

use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

/**
 * Adaptive statistical testing service.
 * Chooses between parametric (t-test / Welch, TOST) and non-parametric (Wilcoxon signed-rank, Mann-Whitney U)
 * based on simple normality diagnostics (Jarque-Bera) and sample size heuristics.
 */
class AdaptiveStatsService
{
    /** Determine if a sample is approximately normal using Jarque-Bera (size < 30). */
    public static function isNormal(array $x, float $alpha = 0.05): array
    {
        $n = count($x);
        if ($n === 0) return ['normal' => false, 'jb' => null, 'p_value' => null, 'method' => 'jb'];
        if ($n >= 30) return ['normal' => true, 'jb' => null, 'p_value' => null, 'method' => 'size']; // CLT heuristic
        $mean = array_sum($x)/$n;
        $m2 = 0; $m3 = 0; $m4 = 0;
        foreach ($x as $v) {
            $d = $v - $mean; $d2 = $d*$d; $m2 += $d2; $m3 += $d2*$d; $m4 += $d2*$d2; 
        }
        if ($m2 == 0) return ['normal' => true, 'jb' => 0.0, 'p_value' => 1.0, 'method' => 'degenerate'];
        $s2 = $m2 / $n; $sd = sqrt($s2);
        $skew = ($m3/$n) / ($sd*$sd*$sd);
        $kurt = ($m4/$n) / ($s2*$s2);
        $jb = ($n/6.0) * ($skew*$skew + pow($kurt - 3.0, 2)/4.0);
        // Chi-square(2) tail probability: p = exp(-x/2)
        $p = exp(-$jb/2.0);
        return ['normal' => $p >= $alpha, 'jb' => $jb, 'p_value' => $p, 'method' => 'jb'];
    }

    /** Wilcoxon signed-rank test (one-sample vs mu0). Returns two-sided p-value (normal approximation). */
    public static function wilcoxonSignedRank(array $x, float $mu0): array
    {
        $diffs = [];
        foreach ($x as $v) { $d = $v - $mu0; if (abs($d) > 1e-12) $diffs[] = $d; }
        $n = count($diffs);
        if ($n < 1) {
            return [ 'method' => 'wilcoxon', 'n' => $n, 'error' => 'all differences zero'];
        }
        // ranks of abs differences with average ties
        $abs = [];
        foreach ($diffs as $i=>$d) $abs[] = ['i'=>$i,'a'=>abs($d),'sign'=>($d>0)?1:-1];
        usort($abs, fn($a,$b)=>($a['a']<=>$b['a']));
        $ranks = array_fill(0,$n,0);
        $rank = 1; $idx=0;
        while ($idx < $n) {
            $j=$idx; while ($j<$n && abs($abs[$j]['a'] - $abs[$idx]['a']) < 1e-12) $j++;
            $avgRank = ($rank + $rank + ($j-$idx) -1)/2.0; // average of sequence
            for ($k=$idx; $k<$j; $k++) $ranks[$abs[$k]['i']] = $avgRank;
            $rank += ($j-$idx); $idx = $j;
        }
        $Wplus=0; $Wminus=0;
        foreach ($diffs as $i=>$d) { if ($d>0) $Wplus += $ranks[$i]; else $Wminus += $ranks[$i]; }
        $nEff = $n;
        $meanW = $nEff*($nEff+1)/4.0;
        $varW = $nEff*($nEff+1)*(2*$nEff+1)/24.0; // ignoring tie correction for simplicity
        if ($varW <= 0) $varW = 1e-9;
        // Use Wplus for z
        $z = ($Wplus - $meanW) / sqrt($varW);
        $p = 2*self::normalTail(abs($z));
        return [
            'method' => 'wilcoxon', 'W_plus'=>$Wplus,'W_minus'=>$Wminus,'n'=>$nEff,'z'=>$z,'p_value'=>$p,
            'statistic'=>$Wplus,'alternative'=>'two-sided','significant'=>$p<0.05
        ];
    }

    /** Mann-Whitney U test (two-sample, independent). Returns two-sided p-value. */
    public static function mannWhitney(array $x, array $y): array
    {
        $n1 = count($x); $n2 = count($y);
        $combined = [];
        foreach ($x as $v) $combined[] = ['v'=>$v,'g'=>1];
        foreach ($y as $v) $combined[] = ['v'=>$v,'g'=>2];
        usort($combined, fn($a,$b)=>($a['v']<=>$b['v']));
        $N = $n1+$n2; $ranks = [];
        $i=0; $rank=1;
        while ($i<$N) {
            $j=$i; while ($j<$N && abs($combined[$j]['v'] - $combined[$i]['v']) < 1e-12) $j++;
            $avgRank = ($rank + $rank + ($j-$i) -1)/2.0;
            for ($k=$i; $k<$j; $k++) $ranks[$k] = $avgRank;
            $rank += ($j-$i); $i=$j;
        }
        $R1=0; for ($k=0;$k<$N;$k++){ if ($combined[$k]['g']==1) $R1 += $ranks[$k]; }
        $U1 = $R1 - $n1*($n1+1)/2.0; $U2 = $n1*$n2 - $U1; $U = min($U1,$U2);
        $meanU = $n1*$n2/2.0; $varU = $n1*$n2*($n1+$n2+1)/12.0; if ($varU<=0) $varU=1e-9;
        $z = ($U1 - $meanU)/sqrt($varU);
        $p = 2*self::normalTail(abs($z));
        return [
            'method'=>'mann-whitney','U'=>$U,'U1'=>$U1,'U2'=>$U2,'n1'=>$n1,'n2'=>$n2,'z'=>$z,'p_value'=>$p,'alternative'=>'two-sided','significant'=>$p<0.05
        ];
    }

    /** Standard normal upper tail probability for |z| (two sided p will multiply outside). */
    protected static function normalTail(float $z): float
    {
        // Abramowitz & Stegun approximation for Phi
        $t = 1/(1+0.2316419*$z);
        $d = 0.3989422804014327*exp(-$z*$z/2);
        $p = $d*$t*(0.319381530 + $t*(-0.356563782 + $t*(1.781477937 + $t*(-1.821255978 + $t*1.330274429))));
        return $p; // upper tail P(Z>z)
    }

    public static function median(array $x): ?float
    {
        $n = count($x); if ($n===0) return null; sort($x); $m = intdiv($n,2); if ($n%2) return $x[$m]; return ($x[$m-1]+$x[$m])/2.0; }
}
