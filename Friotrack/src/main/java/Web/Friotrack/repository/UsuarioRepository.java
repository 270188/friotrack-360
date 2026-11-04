package Web.Friotrack.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import Web.Friotrack.entity.Usuario;

public interface UsuarioRepository extends JpaRepository<Usuario, Long> {

    Optional<Usuario> findByUsername(String username);

    boolean existsByUsername(String username);

    List<Usuario> findByActivoTrue();

    List<Usuario> findByRol(Usuario.Rol rol);

    List<Usuario> findByActivoTrueOrderByApellidoAscNombreAsc();

}
