package Web.Friotrack.service;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import Web.Friotrack.dto.UsuarioDto;
import Web.Friotrack.entity.Usuario;
import Web.Friotrack.exception.BusinessRuleException;
import Web.Friotrack.exception.ConflictException;
import Web.Friotrack.exception.NotFoundException;
import Web.Friotrack.repository.UsuarioRepository;
import Web.Friotrack.security.UsuarioActualProvider;

@Service
@Transactional
public class UsuarioService {

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;
    private final UsuarioActualProvider usuarioActual;

    public UsuarioService(UsuarioRepository usuarioRepository,
                          PasswordEncoder passwordEncoder,
                          UsuarioActualProvider usuarioActual) {
        this.usuarioRepository = usuarioRepository;
        this.passwordEncoder = passwordEncoder;
        this.usuarioActual = usuarioActual;
    }

    public Usuario crear(UsuarioDto.Request request) {
        if (request.password() == null || request.password().isBlank()) {
            throw new BusinessRuleException("La contrasena es obligatoria al crear un usuario");
        }
        if (usuarioRepository.existsByUsername(request.username())) {
            throw new ConflictException("El username " + request.username() + " ya esta registrado");
        }

        Usuario usuario = new Usuario();
        usuario.setNombre(request.nombre());
        usuario.setApellido(request.apellido());
        usuario.setUsername(request.username());
        usuario.setPasswordHash(passwordEncoder.encode(request.password()));
        usuario.setRol(request.rol() != null ? request.rol() : Usuario.Rol.OPERADOR);
        usuario.setActivo(request.activo() != null ? request.activo() : Boolean.TRUE);

        return usuarioRepository.save(usuario);
    }

    public Usuario actualizar(Long id, UsuarioDto.Actualizacion request) {
        Usuario usuario = obtener(id);
        usuario.setNombre(request.nombre());
        usuario.setApellido(request.apellido());
        if (request.rol() != null) {
            usuario.setRol(request.rol());
        }
        if (request.activo() != null) {
            usuario.setActivo(request.activo());
        }
        return usuarioRepository.save(usuario);
    }

    public Usuario cambiarPassword(Long id, UsuarioDto.CambioPassword request) {
        Usuario usuario = obtener(id);

        if (!passwordEncoder.matches(request.passwordActual(), usuario.getPasswordHash())) {
            throw new BusinessRuleException("La contrasena actual no coincide");
        }
        usuario.setPasswordHash(passwordEncoder.encode(request.passwordNuevo()));
        return usuarioRepository.save(usuario);
    }

    public Usuario activar(Long id) {
        Usuario usuario = obtener(id);
        usuario.setActivo(Boolean.TRUE);
        return usuarioRepository.save(usuario);
    }

    public Usuario desactivar(Long id) {
        Usuario usuario = obtener(id);
        if (id.equals(usuarioActual.obtenerId())) {
            throw new BusinessRuleException("Un usuario no puede desactivar su propia cuenta");
        }
        usuario.setActivo(Boolean.FALSE);
        return usuarioRepository.save(usuario);
    }

    @Transactional(readOnly = true)
    public Usuario obtener(Long id) {
        return usuarioRepository.findById(id).orElseThrow(() -> new NotFoundException("Usuario", id));
    }

    @Transactional(readOnly = true)
    public Usuario obtenerPorUsername(String username) {
        return usuarioRepository.findByUsername(username)
                .orElseThrow(() -> new NotFoundException("No existe un usuario con username " + username));
    }

    @Transactional(readOnly = true)
    public Page<Usuario> listar(Pageable pageable) {
        return usuarioRepository.findAll(pageable);
    }

    @Transactional(readOnly = true)
    public List<Usuario> activos() {
        return usuarioRepository.findByActivoTrueOrderByApellidoAscNombreAsc();
    }

    @Transactional(readOnly = true)
    public List<Usuario> porRol(Usuario.Rol rol) {
        return usuarioRepository.findByRol(rol);
    }

}
