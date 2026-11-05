package Web.Friotrack.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Emisor y conexion con SUNAT. Por defecto apunta al entorno BETA (pruebas): los comprobantes
 * se validan en SUNAT pero no tienen valor tributario.
 */
@ConfigurationProperties(prefix = "app.sunat")
public record SunatProperties(
        String entorno,
        String url,
        String ruc,
        String razonSocial,
        String nombreComercial,
        String ubigeo,
        String departamento,
        String provincia,
        String distrito,
        String direccion,
        String usuarioSol,
        String claveSol,
        String certificado,
        String certificadoClave,
        String serieFactura,
        String serieBoleta,
        String serieGuia,
        boolean pruebaAlIniciar) {

    public SunatProperties {
        entorno = valor(entorno, "BETA").toUpperCase();
        ruc = valor(ruc, "20000000001");
        razonSocial = valor(razonSocial, "EMPRESA DE PRUEBA S.A.C.");
        nombreComercial = valor(nombreComercial, null);
        ubigeo = valor(ubigeo, "150101");
        departamento = valor(departamento, "LIMA");
        provincia = valor(provincia, "LIMA");
        distrito = valor(distrito, "LIMA");
        direccion = valor(direccion, "-");
        usuarioSol = valor(usuarioSol, "MODDATOS");
        claveSol = valor(claveSol, "moddatos");
        certificado = valor(certificado, "classpath:sunat/certificado-prueba.p12");
        certificadoClave = valor(certificadoClave, "prueba");
        serieFactura = valor(serieFactura, "F001").toUpperCase();
        serieBoleta = valor(serieBoleta, "B001").toUpperCase();
        serieGuia = valor(serieGuia, "T001").toUpperCase();
        if (!serieFactura.matches("F[A-Z0-9]{3}")) {
            throw new IllegalArgumentException("app.sunat.serie-factura debe tener el formato F### (por ejemplo F001)");
        }
        if (!serieBoleta.matches("B[A-Z0-9]{3}")) {
            throw new IllegalArgumentException("app.sunat.serie-boleta debe tener el formato B### (por ejemplo B001)");
        }
        if (!serieGuia.matches("T[A-Z0-9]{3}")) {
            throw new IllegalArgumentException("app.sunat.serie-guia debe tener el formato T### (por ejemplo T001)");
        }
    }

    public boolean esPrueba() {
        return !"PRODUCCION".equals(entorno);
    }

    private static String valor(String v, String porDefecto) {
        return v == null || v.isBlank() ? porDefecto : v.trim();
    }
}
