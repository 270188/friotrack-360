package Web.Friotrack;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class FriotrackApplication {

	public static void main(String[] args) {
		SpringApplication.run(FriotrackApplication.class, args);
	}

}
