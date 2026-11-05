package Web.Friotrack.sunat;

import java.math.BigDecimal;
import java.math.RoundingMode;

/** Leyenda 1000 de SUNAT: el importe total en letras, por ejemplo "CIENTO DIECIOCHO CON 50/100 SOLES". */
public final class MontoEnLetras {

    private MontoEnLetras() {
    }

    private static final String[] UNIDADES = {"", "UNO", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO",
            "NUEVE", "DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISEIS", "DIECISIETE", "DIECIOCHO",
            "DIECINUEVE", "VEINTE", "VEINTIUNO", "VEINTIDOS", "VEINTITRES", "VEINTICUATRO", "VEINTICINCO",
            "VEINTISEIS", "VEINTISIETE", "VEINTIOCHO", "VEINTINUEVE"};
    private static final String[] DECENAS = {"", "", "", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA",
            "OCHENTA", "NOVENTA"};
    private static final String[] CENTENAS = {"", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS",
            "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"};

    public static String soles(BigDecimal monto) {
        BigDecimal m = monto.setScale(2, RoundingMode.HALF_UP);
        long entero = m.longValue();
        int centimos = m.remainder(BigDecimal.ONE).movePointRight(2).abs().intValue();
        return "SON " + letras(entero) + " CON " + String.format("%02d", centimos) + "/100 SOLES";
    }

    static String letras(long n) {
        if (n == 0) {
            return "CERO";
        }
        if (n < 0) {
            return "MENOS " + letras(-n);
        }
        StringBuilder sb = new StringBuilder();
        long millones = n / 1_000_000;
        long miles = (n / 1_000) % 1_000;
        long resto = n % 1_000;
        if (millones > 0) {
            sb.append(millones == 1 ? "UN MILLON" : apocope(letras(millones)) + " MILLONES");
        }
        if (miles > 0) {
            if (!sb.isEmpty()) {
                sb.append(' ');
            }
            sb.append(miles == 1 ? "MIL" : apocope(centenas((int) miles)) + " MIL");
        }
        if (resto > 0) {
            if (!sb.isEmpty()) {
                sb.append(' ');
            }
            sb.append(centenas((int) resto));
        }
        return sb.toString();
    }

    /** "VEINTIUNO MIL" -> "VEINTIUN MIL", "UNO MILLONES" -> "UN MILLONES". */
    private static String apocope(String s) {
        if (s.endsWith("VEINTIUNO")) {
            return s.substring(0, s.length() - 1);
        }
        if (s.endsWith("UNO")) {
            return s.substring(0, s.length() - 1);
        }
        return s;
    }

    private static String centenas(int n) {
        if (n == 100) {
            return "CIEN";
        }
        int c = n / 100;
        int r = n % 100;
        String dec = decenas(r);
        if (c == 0) {
            return dec;
        }
        return dec.isEmpty() ? CENTENAS[c] : CENTENAS[c] + " " + dec;
    }

    private static String decenas(int n) {
        if (n < 30) {
            return UNIDADES[n];
        }
        int d = n / 10;
        int u = n % 10;
        return u == 0 ? DECENAS[d] : DECENAS[d] + " Y " + UNIDADES[u];
    }
}
