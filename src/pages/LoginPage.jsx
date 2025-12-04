
const COOLDOWN_SECONDS = 300; // 5 minutes

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { signIn, sendPasswordResetLink } = useAuth();
  const { toast } = useToast();

  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    const lastRequestTime = localStorage.getItem('passwordResetRequestTime');
    if (lastRequestTime) {
      const timePassed = (Date.now() - parseInt(lastRequestTime, 10)) / 1000;
      const remainingCooldown = Math.max(0, COOLDOWN_SECONDS - timePassed);
      setCooldown(remainingCooldown);
    }

    let interval;
    if (cooldown > 0) {
      interval = setInterval(() => {
        setCooldown(prev => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, []);

  const handlePasswordReset = async () => {
    if (cooldown > 0) {
      toast({
        variant: "info",
        title: "Aguarde um momento",
        description: `Você poderá solicitar um novo link em ${Math.ceil(cooldown / 60)} minutos.`,
      });
      return;
    }

    if (!email) {
      toast({
        variant: "destructive",
        title: "E-mail necessário",
        description: "Por favor, insira seu e-mail para redefinir a senha.",
      });
      return;
    }
    setLoading(true);
  };

  return (
    <motion.div
      className="flex flex-col items-center justify-center min-h-[70vh]"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
    >
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-slate-800">Painel do Aluno</h1>
      </div>
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-2xl shadow-lg">
        <div className="text-center">
          <h2 className="text-2xl font-bold">
            <span className="text-sky-600">Conexion</span>
            <span className="text-slate-800"> America</span>
          </h2>
          <p className="text-slate-500 mt-2">Faça login para acessar seu painel.</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Senha</Label>
              <button
                type="button"
                onClick={handlePasswordReset}
                className="text-sm font-medium text-sky-600 hover:underline disabled:text-slate-400 disabled:no-underline"
                disabled={cooldown > 0}
              >
                {cooldown > 0 ? (
                  <span className="flex items-center">
                    <Clock className="mr-1 h-4 w-4" />
                    Aguarde {formatTime(cooldown)}
                  </span>
                ) : (
                  'Esqueci a minha senha'
                )}
              </button>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>
          <Button type="submit" className="w-full bg-sky-600 hover:bg-sky-700" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>
        <p className="text-sm text-center text-slate-500">
          Não tem uma conta?{' '}
          <Link to="/register" className="font-medium text-sky-600 hover:underline">
            Registre-se
          </Link>
        </p>
      </div>
    </motion.div>
  );
};

export default LoginPage;