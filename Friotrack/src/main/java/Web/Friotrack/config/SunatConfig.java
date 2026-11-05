package Web.Friotrack.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;

import Web.Friotrack.sunat.ClienteSunat;
import Web.Friotrack.sunat.DocumentoSunat;
import Web.Friotrack.sunat.FirmaDigital;

@Configuration
public class SunatConfig {

    @Bean
    public DocumentoSunat.Emisor emisorSunat(SunatProperties p) {
        return new DocumentoSunat.Emisor(p.ruc(), p.razonSocial(), p.nombreComercial(), p.ubigeo(), p.departamento(),
                p.provincia(), p.distrito(), p.direccion(), p.usuarioSol(), p.claveSol());
    }

    @Bean
    public FirmaDigital firmaDigital(SunatProperties p, ResourceLoader loader) throws Exception {
        Resource r = loader.getResource(p.certificado());
        if (!r.exists()) {
            throw new IllegalStateException("No se encontro el certificado digital: " + p.certificado());
        }
        return new FirmaDigital(r.getInputStream(), p.certificadoClave().toCharArray());
    }

    @Bean
    public ClienteSunat clienteSunat(SunatProperties p) {
        return new ClienteSunat(p.url());
    }
}
